"""Physics-based / data-driven hybrid model (residual or "serial" hybrid).

    y(t) = f_phys(x) + g_ML(x) + ε

f_phys is either the HST model fitted on the calibration window, or a user-supplied physics column (for example the
hydrostatic displacement from a finite-element influence analysis). g_ML is a gradient-boosting model trained on the
calibration residuals of f_phys. Both parts are fitted on the calibration window only and evaluated chronologically,
and the contributions of physics and data are reported separately so attribution stays transparent.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor

from . import hst
from .common import AnalysisError, metrics, numeric, series_payload, time_index, to_jsonable


def fit(df: pd.DataFrame, time_col: str, response_col: str, level_col: str, residual_features: list[str], *, physics_col: str | None = None,
        degree: int = 3, harmonics: int = 2, time_terms: list[str] | None = None, calibration_fraction: float = 0.8,
        n_estimators: int = 300, learning_rate: float = 0.05, max_depth: int = 3, unit: str = "") -> dict:
    d = time_index(df, time_col)
    cols = [response_col, level_col, *residual_features] + ([physics_col] if physics_col else [])
    data = pd.DataFrame({c: numeric(d, c) for c in dict.fromkeys(cols)}, index=d.index).dropna()
    data = data[~data.index.duplicated()]
    if len(data) < 60:
        raise AnalysisError("At least 60 complete observations are required for a hybrid model.")
    n_cal = int(round(calibration_fraction * len(data)))
    cal, val = data.iloc[:n_cal], data.iloc[n_cal:]
    if len(val) < 10:
        raise AnalysisError("Validation period too short; lower the calibration fraction.")
    warnings: list[str] = []
    if physics_col:
        # scale the supplied physics response by least squares on calibration data (y ≈ a + b·phys)
        A = np.column_stack([np.ones(n_cal), cal[physics_col]])
        coef, *_ = np.linalg.lstsq(A, cal[response_col], rcond=None)
        phys = coef[0] + coef[1] * data[physics_col]
        phys_desc = f"supplied physics column '{physics_col}' scaled as a + b·phys (a = {coef[0]:.4g}, b = {coef[1]:.4g}, calibration window)"
    else:
        tmp = data.reset_index().rename(columns={data.index.name or "index": "__t"})
        r = hst.fit(tmp, "__t", response_col, level_col, degree=degree, harmonics=harmonics, time_terms=time_terms if time_terms is not None else ["linear"],
                    calibration_fraction=calibration_fraction)
        phys = pd.Series(hst.predict(r["model_state"], data.index, data[level_col].to_numpy()), index=data.index)
        phys_desc = f"HST baseline: {r['formula']}"
        warnings += [w for w in r["warnings"] if "years" in w]
    resid = data[response_col] - phys
    feats = residual_features or [level_col]
    gbr = GradientBoostingRegressor(n_estimators=n_estimators, learning_rate=learning_rate, max_depth=max_depth, subsample=0.8, random_state=42)
    gbr.fit(cal[feats], resid.iloc[:n_cal])
    corr = pd.Series(gbr.predict(data[feats]), index=data.index)
    hybrid = phys + corr
    m_phys_val = metrics(val[response_col].values, phys.iloc[n_cal:].values)
    m_hyb_val = metrics(val[response_col].values, hybrid.iloc[n_cal:].values)
    gain = (1 - m_hyb_val["RMSE"] / m_phys_val["RMSE"]) * 100 if m_phys_val["RMSE"] else None
    if gain is not None and gain < 0:
        warnings.append("The data-driven correction makes validation error worse than the physics model alone; prefer the physics model.")
    share = float(np.var(corr.iloc[n_cal:]) / max(np.var(hybrid.iloc[n_cal:]), 1e-12))
    imp = sorted(zip(feats, gbr.feature_importances_), key=lambda x: -x[1])
    idx = data.index
    return to_jsonable({
        "method": "Residual hybrid model: physics/statistical baseline + gradient-boosting correction",
        "formula": "y = f_phys(x) + g_ML(x) + ε", "physics_component": phys_desc,
        "ml_component": {"model": "GradientBoostingRegressor", "features": feats, "params": {"n_estimators": n_estimators, "learning_rate": learning_rate, "max_depth": max_depth, "subsample": 0.8},
                         "impurity_importance": [{"feature": f, "importance": v} for f, v in imp]},
        "periods": {"calibration": [idx[0], idx[n_cal - 1]], "validation": [idx[n_cal], idx[-1]], "n_calibration": n_cal, "n_validation": len(val)},
        "metrics": {"physics_only_validation": m_phys_val, "hybrid_validation": m_hyb_val,
                    "physics_only_calibration": metrics(cal[response_col].values, phys.iloc[:n_cal].values), "hybrid_calibration": metrics(cal[response_col].values, hybrid.iloc[:n_cal].values)},
        "validation_rmse_change_percent": -gain if gain is not None else None,
        "data_share_of_variance_validation": share,
        "assumptions": ["The physics baseline captures the dominant mechanism; the ML part only learns systematic residual structure.",
                        "Both parts are fitted on the calibration window only (chronological split).",
                        "Feature relationships in the residual are stable between calibration and validation periods."],
        "warnings": warnings, "unit": unit,
        "series": {"observed": series_payload(idx, data[response_col]), "physics": series_payload(idx, phys), "hybrid": series_payload(idx, hybrid),
                   "ml_correction": series_payload(idx, corr), "residual_hybrid": series_payload(idx, data[response_col] - hybrid)},
    })
