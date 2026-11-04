"""Hydrostatic–Season–Time (HST) behaviour model for dam monitoring data.

Formulation (displayed to the user exactly as fitted):

    y(t) = a0 + Σ_{i=1..p} a_i h^i                      hydrostatic,  h = (H_max − H) / (H_max − H_min)
              + Σ_{k=1..K} [b_k1 sin(k s) + b_k2 cos(k s)]  seasonal,     s = 2π · day_of_year / 365.25
              + c1 t + c2 e^(−t) + c3 ln(1 + t)              time (selected terms), t in years from record start
              + ε

HTT variant: when `temperature_col` is given, the seasonal harmonics are replaced by measured temperature terms
(optionally lagged moving averages).

Calibration and validation are split chronologically; metrics for each period are reported separately and only
the validation metrics describe predictive performance.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.api as sm

from .common import AnalysisError, metrics, numeric, series_payload, time_index, to_jsonable

TIME_TERMS = {"linear": "c·t", "exp": "c·e^(−t)", "log": "c·ln(1+t)"}


def _design(d: pd.DataFrame, level: pd.Series, t0: pd.Timestamp, H_max: float, H_min: float, degree: int, harmonics: int,
            time_terms: list[str], temp: pd.Series | None, temp_lags: list[int]) -> tuple[pd.DataFrame, dict[str, list[str]]]:
    h = (H_max - level) / (H_max - H_min)
    cols: dict[str, pd.Series] = {}
    groups: dict[str, list[str]] = {"hydrostatic": [], "seasonal": [], "time": []}
    for i in range(1, degree + 1):
        name = "h" if i == 1 else f"h^{i}"
        cols[name] = h**i
        groups["hydrostatic"].append(name)
    idx = d.index
    if temp is None:
        s = 2 * np.pi * (idx.day_of_year.to_numpy() - 1 + idx.hour.to_numpy() / 24) / 365.25
        for k in range(1, harmonics + 1):
            for fn, nm in ((np.sin, "sin"), (np.cos, "cos")):
                name = f"{nm}({k}s)" if k > 1 else f"{nm}(s)"
                cols[name] = pd.Series(fn(k * s), index=idx)
                groups["seasonal"].append(name)
    else:
        for lag in temp_lags:
            name = "T" if lag == 0 else f"T_ma{lag}"
            cols[name] = temp if lag == 0 else temp.rolling(f"{lag}D", min_periods=1).mean()
            groups["seasonal"].append(name)
    t = pd.Series((idx - t0).total_seconds() / (365.25 * 86400), index=idx)
    for term in time_terms:
        if term == "linear":
            cols["t"] = t
        elif term == "exp":
            cols["exp(-t)"] = np.exp(-t)
        elif term == "log":
            cols["ln(1+t)"] = np.log1p(t)
        else:
            raise AnalysisError(f"Unknown time term '{term}'. Use linear, exp or log.")
        groups["time"].append(list(cols)[-1])
    X = sm.add_constant(pd.DataFrame(cols, index=idx), has_constant="add")
    return X, groups


def fit(df: pd.DataFrame, time_col: str, response_col: str, level_col: str, *, temperature_col: str | None = None,
        degree: int = 4, harmonics: int = 2, time_terms: list[str] | None = None, temp_lags: list[int] | None = None,
        calibration_fraction: float = 0.8, calibration_end: str | None = None, H_max: float | None = None, H_min: float | None = None,
        alpha: float = 0.05, residual_threshold: float = 2.5, response_unit: str = "", max_points: int = 2000) -> dict:
    if not 1 <= degree <= 5:
        raise AnalysisError("Hydrostatic polynomial degree must be 1–5.")
    if not 0 <= harmonics <= 3:
        raise AnalysisError("Number of seasonal harmonics must be 0–3.")
    time_terms = ["linear", "log"] if time_terms is None else time_terms
    temp_lags = temp_lags or [0]
    d = time_index(df, time_col)
    y = numeric(d, response_col)
    H = numeric(d, level_col)
    T = numeric(d, temperature_col) if temperature_col else None
    data = pd.concat([y.rename("y"), H.rename("H")] + ([T.rename("T")] if T is not None else []), axis=1).dropna()
    data = data[~data.index.duplicated(keep="first")]
    warnings: list[str] = []
    if len(data) < 30:
        raise AnalysisError("At least 30 complete observations are required.")
    span_years = (data.index[-1] - data.index[0]).total_seconds() / (365.25 * 86400)
    if span_years < 2:
        warnings.append(f"Record covers {span_years:.1f} years; at least several complete annual cycles are recommended for HST.")
    # Chronological split
    if calibration_end:
        cut = pd.Timestamp(calibration_end, tz="UTC") if pd.Timestamp(calibration_end).tzinfo is None else pd.Timestamp(calibration_end)
        cal_mask = data.index <= cut
    else:
        if not 0.3 <= calibration_fraction <= 1.0:
            raise AnalysisError("Calibration fraction must be between 0.3 and 1.0.")
        n_cal = int(round(calibration_fraction * len(data)))
        cal_mask = np.zeros(len(data), bool)
        cal_mask[:n_cal] = True
    cal = data[cal_mask]
    if len(cal) < 20:
        raise AnalysisError("Calibration period has fewer than 20 observations.")
    # Normalisation bounds come from the calibration period unless specified (no information from the future).
    Hmax = float(H_max) if H_max is not None else float(cal["H"].max())
    Hmin = float(H_min) if H_min is not None else float(cal["H"].min())
    if Hmax <= Hmin:
        raise AnalysisError("H_max must exceed H_min.")
    t0 = data.index[0]
    X, groups = _design(data, data["H"], t0, Hmax, Hmin, degree, harmonics, time_terms, data["T"] if T is not None else None, temp_lags)
    Xc, yc = X[cal_mask], data["y"][cal_mask]
    if Xc.shape[0] <= Xc.shape[1] + 2:
        raise AnalysisError("Too few calibration observations for the number of model terms.")
    model = sm.OLS(yc, Xc).fit()
    pred_all = model.get_prediction(X).summary_frame(alpha=alpha)
    yhat = pred_all["mean"]
    resid = data["y"] - yhat
    sigma_cal = float(np.std(resid[cal_mask], ddof=Xc.shape[1]))
    std_resid = resid / sigma_cal
    val_mask = ~cal_mask
    # Components (constant reported separately)
    comp = {}
    for g, names in groups.items():
        comp[g] = (X[names] @ model.params[names]) if names else pd.Series(0.0, index=X.index)
    # Extrapolation warnings
    if val_mask.any():
        vH = data["H"][val_mask]
        if vH.max() > cal["H"].max() + 1e-9 or vH.min() < cal["H"].min() - 1e-9:
            warnings.append("Validation period includes reservoir levels outside the calibration range — predictions there are extrapolations.")
    cond = float(np.linalg.cond(Xc.values))
    if cond > 1e8:
        warnings.append(f"Design matrix is ill-conditioned (condition number {cond:.1e}); coefficients may be unstable — consider a lower polynomial degree.")
    from statsmodels.stats.stattools import durbin_watson

    dw = float(durbin_watson(model.resid))
    if dw < 1.5:
        warnings.append(f"Calibration residuals are positively autocorrelated (Durbin–Watson {dw:.2f}); coefficient standard errors and prediction intervals are optimistic.")
    exceed = data.index[(np.abs(std_resid) >= residual_threshold).to_numpy()]
    formula = "y = a0" + "".join(f" + a·{n}" for n in groups["hydrostatic"]) + "".join(f" + b·{n}" for n in groups["seasonal"]) + "".join(f" + c·{n}" for n in groups["time"]) + " + ε"
    ci = model.conf_int(alpha)
    coefs = [{"term": n, "group": next((g for g, v in groups.items() if n in v), "constant"), "estimate": model.params[n], "std_error": model.bse[n],
              "ci_low": ci.loc[n, 0], "ci_high": ci.loc[n, 1], "p_value": model.pvalues[n]} for n in X.columns]
    idx = data.index
    cal_period = [idx[cal_mask][0], idx[cal_mask][-1]]
    val_period = [idx[val_mask][0], idx[val_mask][-1]] if val_mask.any() else None
    result = {
        "method": "HST (hydrostatic–season–time) multiple linear regression, OLS",
        "variant": "HTT (measured temperature)" if T is not None else "HST (seasonal harmonics)",
        "formula": formula,
        "definitions": {"h": f"(H_max − H)/(H_max − H_min), H_max = {Hmax:g}, H_min = {Hmin:g} (from {'user input' if H_max is not None else 'calibration period'})",
                        "s": "2π·(day of year)/365.25" if T is None else None, "t": f"years since {t0.isoformat()}"},
        "assumptions": [
            "Effects of reservoir level, season (or temperature) and time are additive and separable.",
            "Seasonal harmonics represent a repeatable annual thermal cycle." if T is None else "Measured temperature (and moving averages) represent the thermal state of the structure.",
            "The structure's behaviour is unchanged between calibration and validation periods.",
            "Errors are independent with constant variance (checked by diagnostics; usually only approximately true).",
            "Predictions outside the calibrated reservoir range are extrapolations.",
        ],
        "params": {"degree": degree, "harmonics": harmonics, "time_terms": time_terms, "temperature_col": temperature_col, "temp_lags_days": temp_lags if T is not None else None,
                   "calibration_fraction": calibration_fraction if not calibration_end else None, "calibration_end": calibration_end, "alpha": alpha, "residual_threshold": residual_threshold},
        "periods": {"calibration": cal_period, "validation": val_period, "n_calibration": int(cal_mask.sum()), "n_validation": int(val_mask.sum())},
        "coefficients": coefs,
        "metrics": {
            "calibration": metrics(data["y"][cal_mask].values, yhat[cal_mask].values),
            "validation": metrics(data["y"][val_mask].values, yhat[val_mask].values) if val_mask.any() else None,
            "validation_note": "Validation metrics are computed on data not used for fitting; calibration metrics describe goodness of fit only.",
        },
        "calibration_stats": {"R2": model.rsquared, "adj_R2": model.rsquared_adj, "sigma_residual": sigma_cal, "durbin_watson": dw, "condition_number": cond, "AIC": model.aic},
        "prediction_interval_coverage_validation": float(((data["y"][val_mask] >= pred_all["obs_ci_lower"][val_mask]) & (data["y"][val_mask] <= pred_all["obs_ci_upper"][val_mask])).mean()) if val_mask.any() else None,
        "residual_exceedances": {"threshold": residual_threshold, "count": int(len(exceed)), "first": [t.isoformat() for t in exceed[:50]],
                                 "note": "Exceedances are screening flags requiring engineering review, not evidence of damage."},
        "warnings": warnings,
        "unit": response_unit,
        "series": {
            "observed": series_payload(idx, data["y"], max_points), "predicted": series_payload(idx, yhat, max_points),
            "pi_low": series_payload(idx, pred_all["obs_ci_lower"], max_points), "pi_high": series_payload(idx, pred_all["obs_ci_upper"], max_points),
            "hydrostatic": series_payload(idx, comp["hydrostatic"], max_points), "seasonal": series_payload(idx, comp["seasonal"], max_points),
            "time": series_payload(idx, comp["time"], max_points), "residual": series_payload(idx, resid, max_points),
            "std_residual": series_payload(idx, std_resid, max_points), "level": series_payload(idx, data["H"], max_points),
        },
        "calibration_end_time": cal_period[1],
        "model_state": {"params": model.params.to_dict(), "groups": groups, "H_max": Hmax, "H_min": Hmin, "t0": t0.isoformat(), "degree": degree,
                        "harmonics": harmonics, "time_terms": time_terms, "temperature": T is not None, "temp_lags": temp_lags, "sigma": sigma_cal},
    }
    return to_jsonable(result)


def predict(model_state: dict, times: pd.DatetimeIndex, level: np.ndarray, temperature: np.ndarray | None = None) -> np.ndarray:
    """Evaluate a fitted HST model (as stored in `model_state`) for new times and reservoir levels."""
    idx = pd.DatetimeIndex(times)
    if idx.tz is None:
        idx = idx.tz_localize("UTC")
    d = pd.DataFrame(index=idx)
    H = pd.Series(np.asarray(level, float), index=idx)
    T = pd.Series(np.asarray(temperature, float), index=idx) if model_state.get("temperature") else None
    X, _ = _design(d, H, pd.Timestamp(model_state["t0"]), model_state["H_max"], model_state["H_min"], model_state["degree"],
                   model_state["harmonics"], model_state["time_terms"], T, model_state.get("temp_lags") or [0])
    params = pd.Series(model_state["params"])
    return (X[params.index] @ params).to_numpy()
