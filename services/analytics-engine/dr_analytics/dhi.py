"""Quantitative Dam Health Index — configurable and fully documented.

No default weights or condition thresholds are supplied: users must provide them (with justification),
and the result records them so that every index value is traceable.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .common import AnalysisError, to_jsonable

RANDOM_INDEX = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49}  # Saaty


def ahp_weights(matrix: list[list[float]]) -> dict:
    A = np.asarray(matrix, float)
    n = A.shape[0]
    if A.shape != (n, n) or n < 2:
        raise AnalysisError("Pairwise comparison matrix must be square (n ≥ 2).")
    if np.any(A <= 0):
        raise AnalysisError("Pairwise judgements must be positive.")
    if not np.allclose(A * A.T, 1.0, atol=1e-6):
        raise AnalysisError("Matrix must be reciprocal: a_ji = 1 / a_ij.")
    vals, vecs = np.linalg.eig(A)
    k = int(np.argmax(vals.real))
    w = np.abs(vecs[:, k].real)
    w = w / w.sum()
    lam = float(vals[k].real)
    ci = (lam - n) / (n - 1) if n > 2 else 0.0
    ri = RANDOM_INDEX.get(n, 1.49)
    cr = ci / ri if ri else 0.0
    return {"weights": w.tolist(), "lambda_max": lam, "CI": ci, "RI": ri, "CR": cr, "consistent": bool(cr < 0.10),
            "note": "CR < 0.10 is the conventional acceptance level for pairwise consistency (Saaty)."}


def _normalise(value, ind: dict) -> float:
    good, poor = float(ind["ref_good"]), float(ind["ref_poor"])
    if good == poor:
        raise AnalysisError(f"Indicator '{ind['name']}': reference values must differ.")
    v = (value - poor) / (good - poor)
    return float(np.clip(v, 0.0, 1.0))


def compute(indicators: list[dict], *, weights: list[float] | None = None, ahp_matrix: list[list[float]] | None = None, aggregation: str = "arithmetic",
            classes: list[dict] | None = None, weight_justification: str = "", df: pd.DataFrame | None = None, time_col: str | None = None,
            periods: list[dict] | None = None, sensitivity_delta: float = 0.2) -> dict:
    """indicators: [{name, column? | value?, ref_good, ref_poor, unit?, justification?}]
    classes: [{label, min}] sorted by min descending (index ≥ min → label). Must be supplied by the user to classify."""
    if not indicators:
        raise AnalysisError("Define at least one indicator.")
    n = len(indicators)
    ahp = None
    if ahp_matrix is not None:
        ahp = ahp_weights(ahp_matrix)
        if len(ahp["weights"]) != n:
            raise AnalysisError("AHP matrix size must equal the number of indicators.")
        w = np.array(ahp["weights"])
        source = "AHP eigenvector"
    elif weights is not None:
        w = np.asarray(weights, float)
        if len(w) != n or np.any(w < 0) or w.sum() <= 0:
            raise AnalysisError("Provide one non-negative weight per indicator.")
        w = w / w.sum()
        source = "user-specified (normalised to sum 1)"
    else:
        raise AnalysisError("Weights are required: specify them directly or via an AHP pairwise matrix. No default weights are applied.")
    if aggregation not in {"arithmetic", "geometric", "minimum"}:
        raise AnalysisError("aggregation must be arithmetic, geometric or minimum")

    def agg(vals: np.ndarray, ww: np.ndarray) -> float:
        if aggregation == "arithmetic":
            return float(np.sum(ww * vals))
        if aggregation == "geometric":
            return float(np.exp(np.sum(ww * np.log(np.clip(vals, 1e-9, 1)))))
        return float(np.min(vals))

    def classify(x: float) -> str:
        if not classes:
            return "Unclassified (no project-specific classes supplied)"
        for c in sorted(classes, key=lambda c: -float(c["min"])):
            if x >= float(c["min"]):
                return str(c["label"])
        return "Below lowest class"

    # Current values: explicit value, or last non-missing value of a column
    def current_value(ind):
        if "value" in ind and ind["value"] is not None:
            return float(ind["value"])
        if df is None or not ind.get("column"):
            raise AnalysisError(f"Indicator '{ind['name']}' needs a value or a dataset column.")
        s = pd.to_numeric(df[ind["column"]], errors="coerce").dropna()
        if s.empty:
            raise AnalysisError(f"Column '{ind['column']}' has no numeric values.")
        return float(s.iloc[-1])

    raw = np.array([current_value(i) for i in indicators])
    normed = np.array([_normalise(v, i) for v, i in zip(raw, indicators)])
    index = agg(normed, w)
    # One-at-a-time weight sensitivity
    sens = []
    for k in range(n):
        out = []
        for f in (1 - sensitivity_delta, 1 + sensitivity_delta):
            ww = w.copy(); ww[k] *= f; ww /= ww.sum()
            out.append(agg(normed, ww))
        sens.append({"indicator": indicators[k]["name"], "index_low": out[0], "index_high": out[1], "range": abs(out[1] - out[0]),
                     "class_changes": classify(out[0]) != classify(index) or classify(out[1]) != classify(index)})
    # Time history (if a dataset with all indicator columns is given)
    history = None
    if df is not None and time_col and all(i.get("column") for i in indicators):
        t = pd.to_datetime(df[time_col], errors="coerce", utc=True)
        M = pd.DataFrame({i["name"]: pd.to_numeric(df[i["column"]], errors="coerce") for i in indicators})
        M.index = t
        M = M[M.index.notna()].dropna().sort_index()
        if len(M):
            NM = np.column_stack([np.clip((M[i["name"]] - float(i["ref_poor"])) / (float(i["ref_good"]) - float(i["ref_poor"])), 0, 1) for i in indicators])
            vals = np.array([agg(row, w) for row in NM])
            step = max(1, len(vals) // 1500)
            history = {"x": [x.isoformat() for x in M.index[::step]], "y": vals[::step].tolist()}
            if periods:
                comp = []
                for p in periods:
                    m = (M.index >= pd.Timestamp(p["start"], tz="UTC")) & (M.index <= pd.Timestamp(p["end"], tz="UTC"))
                    comp.append({"label": p.get("label", f"{p['start']}–{p['end']}"), "mean_index": float(vals[m].mean()) if m.any() else None, "n": int(m.sum())})
                history["periods"] = comp
    worst = int(np.argmin(normed))
    return to_jsonable({
        "method": "Dam Health Index (normalised weighted aggregation)", "aggregation": aggregation, "weight_source": source,
        "weight_justification": weight_justification or "Not provided — the index cannot be considered documented until weights are justified.",
        "indicators": [{**i, "current_value": float(v), "normalised": float(nv), "weight": float(ww), "contribution": float(nv * ww)} for i, v, nv, ww in zip(indicators, raw, normed, w)],
        "ahp": ahp, "index": index, "classification": classify(index), "classes": classes or [],
        "sensitivity": sens, "history": history,
        "interpretation": f"Lowest normalised indicator: {indicators[worst]['name']} ({normed[worst]:.2f}). " + (
            "Under ±{:.0f} % weight perturbations the class is stable.".format(sensitivity_delta * 100) if not any(s["class_changes"] for s in sens)
            else "The condition class changes under plausible weight perturbations — report the class as uncertain."),
        "limitations": ["The index depends on the chosen indicators, reference values, weights and aggregation; these are engineering judgements.",
                        "Normalisation is linear between the user-defined 'good' and 'poor' references and clipped to [0, 1].",
                        "The index is decision support and does not replace inspection, analysis or the responsible engineer's assessment."],
    })
