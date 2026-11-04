"""Anomaly screening and change-point detection. Outputs are screening flags for engineering review."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats as sst

from .common import AnalysisError, numeric, series_payload, time_index, to_jsonable

NOTE = "Flags indicate statistical novelty only. They may arise from sensor faults, data errors, operational changes or physical change and require verification."


def _flags(idx, mask, values, score):
    out = []
    for t, v, s in zip(idx[mask][:200], values[mask][:200], score[mask][:200]):
        out.append({"time": t, "value": v, "score": s})
    return out


def residual_zscore(df: pd.DataFrame, column: str, time_col: str | None = None, threshold: float = 3.0, baseline_fraction: float = 0.5, max_points: int = 1500) -> dict:
    """Standardise a residual (or any) series by the mean/std of a baseline period and flag |z| ≥ threshold."""
    d = time_index(df, time_col) if time_col else df
    s = numeric(d, column).dropna()
    nb = max(10, int(len(s) * baseline_fraction))
    mu, sd = s.iloc[:nb].mean(), s.iloc[:nb].std()
    if not sd:
        raise AnalysisError("Baseline period has zero variance.")
    z = (s - mu) / sd
    mask = (np.abs(z) >= threshold).to_numpy()
    return to_jsonable({"method": "Baseline z-score screening", "params": {"threshold": threshold, "baseline_fraction": baseline_fraction}, "baseline": {"mean": mu, "std": sd, "n": nb},
                        "n_flags": int(mask.sum()), "flags": _flags(s.index, mask, s.values, z.values), "series": {"value": series_payload(s.index, s, max_points), "z": series_payload(s.index, z, max_points)}, "note": NOTE})


def cusum(df: pd.DataFrame, column: str, time_col: str | None = None, k: float = 0.5, h: float = 5.0, baseline_fraction: float = 0.5, max_points: int = 1500) -> dict:
    """Two-sided tabular CUSUM on standardised values (Page, 1954). k and h in standard deviations."""
    d = time_index(df, time_col) if time_col else df
    s = numeric(d, column).dropna()
    nb = max(10, int(len(s) * baseline_fraction))
    mu, sd = s.iloc[:nb].mean(), s.iloc[:nb].std()
    z = ((s - mu) / sd).to_numpy()
    sp, sn = np.zeros(len(z)), np.zeros(len(z))
    for i in range(1, len(z)):
        sp[i] = max(0.0, sp[i - 1] + z[i] - k)
        sn[i] = max(0.0, sn[i - 1] - z[i] - k)
    alarm = (sp > h) | (sn > h)
    first = s.index[np.argmax(alarm)] if alarm.any() else None
    return to_jsonable({"method": "Two-sided tabular CUSUM", "params": {"k_sigma": k, "h_sigma": h, "baseline_fraction": baseline_fraction}, "baseline": {"mean": mu, "std": sd},
                        "first_alarm": first, "n_alarm_samples": int(alarm.sum()),
                        "series": {"value": series_payload(s.index, s, max_points), "S_plus": series_payload(s.index, sp, max_points), "S_minus": series_payload(s.index, sn, max_points)}, "note": NOTE})


def change_points(df: pd.DataFrame, column: str, time_col: str | None = None, max_changes: int = 5, min_size: int = 10, penalty: float | None = None) -> dict:
    """Binary segmentation for changes in mean with a BIC-type penalty (Gaussian, common variance)."""
    d = time_index(df, time_col) if time_col else df
    s = numeric(d, column).dropna()
    x = s.to_numpy()
    n = len(x)
    if n < 2 * min_size:
        raise AnalysisError("Series too short for change-point detection.")
    sigma2 = np.var(np.diff(x)) / 2 or np.var(x) or 1.0
    pen = penalty if penalty is not None else 2 * np.log(n) * sigma2

    def cost(a, b):
        seg = x[a:b]
        return float(np.sum((seg - seg.mean()) ** 2))

    segments, cps = [(0, n)], []
    for _ in range(max_changes):
        best = None
        for a, b in segments:
            if b - a < 2 * min_size:
                continue
            c0 = cost(a, b)
            cs = np.cumsum(x[a:b]); cs2 = np.cumsum(x[a:b] ** 2)
            tot, tot2, m = cs[-1], cs2[-1], b - a
            ks = np.arange(min_size, m - min_size)
            left = cs2[ks - 1] - cs[ks - 1] ** 2 / ks
            right = (tot2 - cs2[ks - 1]) - (tot - cs[ks - 1]) ** 2 / (m - ks)
            gain = c0 - (left + right)
            j = int(np.argmax(gain))
            if best is None or gain[j] > best[0]:
                best = (gain[j], a, b, a + int(ks[j]))
        if best is None or best[0] < pen:
            break
        _, a, b, k = best
        segments.remove((a, b)); segments += [(a, k), (k, b)]; cps.append(k)
    cps.sort()
    bounds = [0] + cps + [n]
    segs = [{"start": s.index[bounds[i]], "end": s.index[bounds[i + 1] - 1], "mean": float(x[bounds[i]:bounds[i + 1]].mean()), "n": bounds[i + 1] - bounds[i]} for i in range(len(bounds) - 1)]
    return to_jsonable({"method": "Binary segmentation (mean shifts, BIC-type penalty)", "params": {"max_changes": max_changes, "min_size": min_size, "penalty": pen},
                        "change_points": [s.index[c] for c in cps], "segments": segs, "series": series_payload(s.index, s), "note": NOTE})


def multivariate(df: pd.DataFrame, columns: list[str], time_col: str | None = None, method: str = "mahalanobis", baseline_fraction: float = 0.5,
                 alpha: float = 0.001, contamination: float = 0.01, max_points: int = 1500) -> dict:
    """Mahalanobis distance against a baseline (χ² threshold) or Isolation Forest scores."""
    d = time_index(df, time_col) if time_col else df
    X = pd.DataFrame({c: numeric(d, c) for c in columns}).dropna()
    if len(columns) < 2:
        raise AnalysisError("Select at least two variables.")
    nb = max(len(columns) * 5, int(len(X) * baseline_fraction))
    base = X.iloc[:nb]
    if method == "mahalanobis":
        mu = base.mean().to_numpy(); cov = np.cov(base.to_numpy().T)
        inv = np.linalg.pinv(cov)
        diff = X.to_numpy() - mu
        d2 = np.einsum("ij,jk,ik->i", diff, inv, diff)
        thr = float(sst.chi2.ppf(1 - alpha, df=len(columns)))
        mask = d2 > thr
        score = d2
        meta = {"threshold_D2": thr, "alpha": alpha, "distribution": f"chi-square, {len(columns)} dof (assumes multivariate normal baseline)"}
    elif method == "isolation_forest":
        from sklearn.ensemble import IsolationForest
        iso = IsolationForest(n_estimators=300, contamination=contamination, random_state=42).fit(base)
        score = -iso.score_samples(X)
        mask = iso.predict(X) == -1
        meta = {"contamination": contamination, "note": "contamination sets the expected flag rate; it is an assumption, not a measured quantity"}
    else:
        raise AnalysisError("method must be mahalanobis or isolation_forest")
    return to_jsonable({"method": "Multivariate novelty detection", "algorithm": method, "variables": columns, "baseline": {"n": nb, "start": X.index[0], "end": X.index[nb - 1]},
                        "params": meta, "n_flags": int(mask.sum()), "flags": _flags(X.index, mask, X.iloc[:, 0].to_numpy(), score), "series": {"score": series_payload(X.index, score, max_points)}, "note": NOTE})
