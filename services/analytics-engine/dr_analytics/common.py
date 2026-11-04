from __future__ import annotations

import math
from typing import Any, Iterable

import numpy as np
import pandas as pd


class AnalysisError(ValueError):
    """Raised for invalid user input; the message is safe to show to the user."""


def to_jsonable(obj: Any) -> Any:
    """Recursively convert numpy/pandas objects into JSON-safe Python values (NaN/inf -> None)."""
    if isinstance(obj, dict):
        return {str(k): to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return [to_jsonable(v) for v in obj.tolist()]
    if isinstance(obj, (pd.Series, pd.Index)):
        return [to_jsonable(v) for v in obj.tolist()]
    if isinstance(obj, pd.DataFrame):
        return to_jsonable(obj.to_dict(orient="records"))
    if isinstance(obj, (pd.Timestamp, np.datetime64)):
        ts = pd.Timestamp(obj)
        return None if pd.isna(ts) else ts.isoformat()
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (float, np.floating)):
        f = float(obj)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if obj is pd.NaT:
        return None
    return obj


def lttb(x: np.ndarray, y: np.ndarray, threshold: int) -> np.ndarray:
    """Largest-Triangle-Three-Buckets downsampling for display. Returns selected indices.
    The stored data are never modified; this only reduces points sent to charts."""
    n = len(x)
    if threshold >= n or threshold < 3:
        return np.arange(n)
    mask = np.isfinite(y)
    idx_all = np.arange(n)[mask]
    if len(idx_all) <= threshold:
        return idx_all
    xs, ys = x[mask].astype(float), y[mask].astype(float)
    m = len(xs)
    every = (m - 2) / (threshold - 2)
    sel = [0]
    a = 0
    for i in range(threshold - 2):
        start = int(math.floor((i + 1) * every)) + 1
        end = min(int(math.floor((i + 2) * every)) + 1, m)
        avg_x, avg_y = xs[start:end].mean(), ys[start:end].mean()
        rs, re = int(math.floor(i * every)) + 1, int(math.floor((i + 1) * every)) + 1
        ax, ay = xs[a], ys[a]
        area = np.abs((ax - avg_x) * (ys[rs:re] - ay) - (ax - xs[rs:re]) * (avg_y - ay))
        a = rs + int(np.argmax(area))
        sel.append(a)
    sel.append(m - 1)
    return idx_all[np.array(sel)]


def series_payload(index: pd.Index | np.ndarray, values: Iterable, max_points: int = 1500) -> dict:
    """Package a series for charts, downsampled with LTTB when longer than max_points."""
    vals = np.asarray(list(values), dtype=float)
    idx = pd.Index(index)
    if isinstance(idx, pd.DatetimeIndex):
        xnum = idx.asi8.astype(float)
        xs = [t.isoformat() for t in idx]
    else:
        xnum = np.asarray(idx, dtype=float)
        xs = list(xnum)
    keep = lttb(xnum, vals, max_points) if len(vals) > max_points else np.arange(len(vals))
    return {"x": to_jsonable([xs[i] for i in keep]), "y": to_jsonable(vals[keep]), "n_total": int(len(vals)), "downsampled": bool(len(keep) < len(vals))}


def metrics(y: np.ndarray, yhat: np.ndarray) -> dict:
    y, yhat = np.asarray(y, float), np.asarray(yhat, float)
    m = np.isfinite(y) & np.isfinite(yhat)
    y, yhat = y[m], yhat[m]
    n = len(y)
    if n == 0:
        return {"n": 0}
    err = y - yhat
    sst = float(np.sum((y - y.mean()) ** 2))
    out = {
        "n": n,
        "MAE": float(np.mean(np.abs(err))),
        "RMSE": float(np.sqrt(np.mean(err**2))),
        "R2": float(1 - np.sum(err**2) / sst) if sst > 0 else None,
        "bias": float(np.mean(-err)),
        "max_abs_error": float(np.max(np.abs(err))),
    }
    # MAPE is reported only where it is mathematically meaningful (target bounded away from zero, single sign).
    if np.all(y > 0) or np.all(y < 0):
        if np.min(np.abs(y)) > 1e-6 * max(1.0, float(np.max(np.abs(y)))):
            out["MAPE_percent"] = float(np.mean(np.abs(err / y)) * 100)
    if "MAPE_percent" not in out:
        out["MAPE_note"] = "MAPE not reported: target crosses or approaches zero."
    return out


def require_columns(df: pd.DataFrame, cols: Iterable[str]) -> None:
    missing = [c for c in cols if c and c not in df.columns]
    if missing:
        raise AnalysisError(f"Column(s) not found: {', '.join(missing)}")


def numeric(df: pd.DataFrame, col: str) -> pd.Series:
    require_columns(df, [col])
    s = pd.to_numeric(df[col], errors="coerce")
    if s.notna().sum() == 0:
        raise AnalysisError(f"Column '{col}' contains no numeric values.")
    return s


def time_index(df: pd.DataFrame, time_col: str | None) -> pd.DataFrame:
    """Return a copy indexed by a timezone-aware UTC DatetimeIndex (naive timestamps are assumed UTC and reported)."""
    if not time_col:
        return df.reset_index(drop=True)
    require_columns(df, [time_col])
    t = pd.to_datetime(df[time_col], errors="coerce", utc=True)
    if t.notna().sum() == 0:
        raise AnalysisError(f"Column '{time_col}' could not be parsed as date/time.")
    out = df.drop(columns=[time_col]).copy()
    out.index = pd.DatetimeIndex(t, name=time_col)
    out = out[out.index.notna()].sort_index()
    return out
