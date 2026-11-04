"""Seismic fragility fitting (lognormal) from dynamic-analysis results.

Methods
* MLE on multiple-stripe / binary outcomes (Baker 2015): maximise Σ [z ln Φ(...) + (n−z) ln(1−Φ(...))].
* IDA capacities (method of moments on ln IM at which the damage state is reached).
Confidence bands by bootstrap resampling of records. Parameters come only from user data — no defaults are assumed.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import optimize, stats

from .common import AnalysisError, numeric, to_jsonable


def _nll(params, im, n, z):
    lt, lb = params
    p = stats.norm.cdf((np.log(im) - lt) / np.exp(lb))
    p = np.clip(p, 1e-12, 1 - 1e-12)
    return -np.sum(z * np.log(p) + (n - z) * np.log(1 - p))


def mle(im: np.ndarray, n: np.ndarray, z: np.ndarray) -> tuple[float, float, float]:
    x0 = [np.log(np.median(im)), np.log(0.4)]
    r = optimize.minimize(_nll, x0, args=(im, n, z), method="Nelder-Mead", options={"xatol": 1e-8, "fatol": 1e-10, "maxiter": 4000})
    return float(np.exp(r.x[0])), float(np.exp(r.x[1])), float(r.fun)


def fit(df: pd.DataFrame, method: str = "mle", im_col: str = "pga_g", outcome_col: str | None = "exceeds_ds2", capacity_col: str | None = None,
        record_col: str | None = "record_id", edp_col: str | None = None, edp_threshold: float | None = None,
        n_boot: int = 300, im_grid_max: float | None = None, damage_state: str = "DS", im_label: str = "PGA (g)", seed: int = 42) -> dict:
    rng = np.random.default_rng(seed)
    warnings: list[str] = []
    if method == "mle":
        im = numeric(df, im_col)
        if edp_col and edp_threshold is not None:
            out = (numeric(df, edp_col) >= edp_threshold).astype(int)
            basis = f"{edp_col} ≥ {edp_threshold:g}"
        elif outcome_col:
            out = numeric(df, outcome_col).astype(int)
            basis = f"binary outcome column '{outcome_col}'"
        else:
            raise AnalysisError("Provide an outcome column or an EDP column with a threshold.")
        data = pd.DataFrame({"im": im, "z": out, "rec": df[record_col] if record_col and record_col in df else np.arange(len(df))}).dropna()
        if (data["im"] <= 0).any():
            raise AnalysisError("Intensity measures must be positive.")
        g = data.groupby("im").agg(n=("z", "size"), z=("z", "sum")).reset_index()
        if len(g) < 3:
            raise AnalysisError("At least three intensity levels are needed.")
        theta, beta, nll = mle(g["im"].to_numpy(), g["n"].to_numpy(), g["z"].to_numpy())
        recs = data["rec"].unique()
        boots = []
        for _ in range(n_boot):
            pick = rng.choice(recs, size=len(recs), replace=True)
            bd = pd.concat([data[data["rec"] == r] for r in pick])
            bg = bd.groupby("im").agg(n=("z", "size"), z=("z", "sum")).reset_index()
            if len(bg) >= 3 and 0 < bg["z"].sum() < bg["n"].sum():
                boots.append(mle(bg["im"].to_numpy(), bg["n"].to_numpy(), bg["z"].to_numpy())[:2])
        observed = {"im": g["im"], "fraction": g["z"] / g["n"], "n": g["n"]}
        aic = 2 * 2 + 2 * nll
    elif method == "ida":
        if not capacity_col:
            raise AnalysisError("IDA method needs a capacity column (IM at which the damage state is reached for each record).")
        cap = numeric(df, capacity_col).dropna()
        if (cap <= 0).any() or len(cap) < 5:
            raise AnalysisError("Need at least 5 positive capacities.")
        ln = np.log(cap.to_numpy())
        theta, beta = float(np.exp(ln.mean())), float(ln.std(ddof=1))
        boots = [(float(np.exp(s.mean())), float(s.std(ddof=1))) for s in (rng.choice(ln, size=len(ln), replace=True) for _ in range(n_boot))]
        srt = np.sort(cap.to_numpy())
        observed = {"im": srt, "fraction": np.arange(1, len(srt) + 1) / len(srt), "n": np.ones(len(srt))}
        basis = f"IDA capacities in column '{capacity_col}'"
        aic = None
    else:
        raise AnalysisError("method must be 'mle' or 'ida'.")
    grid = np.linspace(1e-3, im_grid_max or float(np.max(observed["im"])) * 1.6, 200)
    curve = stats.norm.cdf(np.log(grid / theta) / beta)
    band = None
    if len(boots) >= 20:
        B = np.array([stats.norm.cdf(np.log(grid / t) / b) for t, b in boots])
        band = {"p05": np.percentile(B, 5, axis=0), "p95": np.percentile(B, 95, axis=0)}
        tb = np.array(boots)
        ci = {"theta": np.percentile(tb[:, 0], [5, 95]), "beta": np.percentile(tb[:, 1], [5, 95])}
    else:
        ci = None
        warnings.append("Too few valid bootstrap samples for confidence bands.")
    if beta < 0.1 or beta > 1.2:
        warnings.append(f"Dispersion β = {beta:.2f} is unusual; check the analysis results and damage-state definition.")
    sens = [{"im": float(x), "p": float(stats.norm.cdf(np.log(x / theta) / beta))} for x in np.round(np.quantile(observed["im"], [0.25, 0.5, 0.75]), 3)]
    return to_jsonable({
        "method": "Lognormal fragility, maximum likelihood (multiple stripes)" if method == "mle" else "Lognormal fragility, IDA capacities (method of moments)",
        "damage_state": damage_state, "basis": basis, "im_label": im_label,
        "theta": theta, "beta": beta, "ci_90": ci, "aic": aic, "n_bootstrap": len(boots),
        "curve": {"im": grid, "p": curve, "band": band}, "observed": observed, "probabilities_at": sens,
        "equation": f"P({damage_state} | IM = x) = Φ( ln(x / {theta:.3g}) / {beta:.3g} )",
        "record_to_record_note": "β combines record-to-record variability with any modelling uncertainty represented in the analyses; epistemic uncertainty not included in the analyses is not captured.",
        "warnings": warnings,
        "limitations": ["Valid only for the structure, model, ground-motion set and damage-state definition used in the analyses.", "Not a seismic safety assessment by itself."],
    })
