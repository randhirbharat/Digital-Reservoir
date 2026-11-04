"""Data-quality assessment and documented, non-destructive processing operations."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .common import AnalysisError, numeric, require_columns, to_jsonable


def _mad_z(s: pd.Series) -> pd.Series:
    med = s.median()
    mad = (s - med).abs().median()
    if not mad or np.isnan(mad):
        return pd.Series(0.0, index=s.index)
    return 0.6745 * (s - med) / mad


def _hampel_z(s: pd.Series, window: int) -> pd.Series:
    """Local robust z-score: deviation from the centred rolling median divided by the scaled rolling MAD (Hampel)."""
    med = s.rolling(window, center=True, min_periods=max(3, window // 2)).median()
    mad = (s - med).abs().rolling(window, center=True, min_periods=max(3, window // 2)).median()
    floor = 0.6745 * (s - s.median()).abs().median() * 0.05 or 1e-12  # avoid division by ~0 on flat segments
    return 0.6745 * (s - med) / mad.clip(lower=floor)


def outlier_scores(s: pd.Series, method: str = "hampel", window: int = 11) -> pd.Series:
    if method == "hampel":
        return _hampel_z(s, window)
    if method == "global_mad":
        return _mad_z(s)
    raise AnalysisError("Outlier method must be 'hampel' (local, for time series) or 'global_mad'.")


def assess(df: pd.DataFrame, time_col: str | None = None, mad_threshold: float = 5.0, gap_factor: float = 3.0,
           outlier_method: str | None = None, window: int = 11) -> dict:
    """Missing data, duplicates, outliers (robust local or global MAD z-score) and sampling regularity. Nothing is modified."""
    outlier_method = outlier_method or ("hampel" if time_col else "global_mad")
    res: dict = {"method": "Data-quality assessment", "params": {"time_col": time_col, "mad_threshold": mad_threshold, "gap_factor": gap_factor,
                 "outlier_method": outlier_method, "hampel_window": window if outlier_method == "hampel" else None}, "warnings": []}
    res["rows"] = int(len(df))
    res["duplicate_rows"] = int(df.duplicated().sum())
    cols = []
    for c in df.columns:
        if c == time_col:
            continue
        raw = df[c]
        s = pd.to_numeric(raw, errors="coerce")
        info = {"column": c, "missing": int(raw.isna().sum() + ((raw.astype(str).str.strip() == "") & raw.notna()).sum())}
        if s.notna().sum() >= max(5, 0.5 * raw.notna().sum()):
            sv = s.dropna()
            if time_col:
                order = pd.to_datetime(df.loc[sv.index, time_col], errors="coerce", utc=True).argsort(kind="stable")
                sv = sv.iloc[order]
            z = outlier_scores(sv, outlier_method, window)
            out_idx = z[np.abs(z) > mad_threshold].index
            info.update({
                "kind": "numeric", "non_numeric": int(raw.notna().sum() - s.notna().sum()),
                "min": s.min(), "max": s.max(), "mean": s.mean(), "std": s.std(),
                "outliers": int(len(out_idx)), "outlier_rows": [int(i) for i in out_idx[:50]],
            })
        else:
            info["kind"] = "text"
        cols.append(info)
    res["columns"] = cols
    if time_col:
        require_columns(df, [time_col])
        t = pd.to_datetime(df[time_col], errors="coerce", utc=True)
        res["unparseable_timestamps"] = int(t.isna().sum() - df[time_col].isna().sum())
        res["duplicate_timestamps"] = int(t.duplicated(keep="first").sum())
        ts = t.dropna().sort_values()
        if len(ts) > 2:
            d = ts.diff().dropna().dt.total_seconds()
            med = float(d.median())
            res["sampling"] = {
                "median_interval_s": med, "min_interval_s": float(d.min()), "max_interval_s": float(d.max()),
                "irregular_fraction": float((np.abs(d - med) > 0.01 * med).mean()) if med > 0 else None,
                "start": ts.iloc[0], "end": ts.iloc[-1],
            }
            gaps = d[d > gap_factor * med] if med > 0 else d.iloc[0:0]
            res["gaps"] = [{"after": ts.iloc[i], "duration_s": float(v)} for i, v in zip(gaps.index[:50] - 1, gaps.values[:50])]
            if not (t.dropna().is_monotonic_increasing):
                res["warnings"].append("Timestamps are not in chronological order.")
        tz_aware = isinstance(df[time_col].dtype, pd.DatetimeTZDtype) or df[time_col].astype(str).str.contains(r"(?:Z|[+-]\d\d:?\d\d)$", regex=True).mean() > 0.5
        if not tz_aware:
            res["warnings"].append("Timestamps have no time-zone information; they are interpreted as UTC.")
    return to_jsonable(res)


# ---------------------------------------------------------------- processing operations
# Each operation: (df, params) -> (new_df, summary string). Inputs are never modified in place.

def op_drop_duplicates(df: pd.DataFrame, p: dict) -> tuple[pd.DataFrame, str]:
    subset = p.get("subset") or None
    if subset:
        require_columns(df, subset)
    out = df.drop_duplicates(subset=subset, keep="first")
    return out.reset_index(drop=True), f"Removed {len(df) - len(out)} duplicate row(s) (keep first; subset={subset or 'all columns'})."


def op_flag_outliers_to_missing(df: pd.DataFrame, p: dict) -> tuple[pd.DataFrame, str]:
    col, thr = p["column"], float(p.get("mad_threshold", 5.0))
    method, window = p.get("method", "hampel"), int(p.get("window", 11))
    s = numeric(df, col)
    z = outlier_scores(s.dropna(), method, window)
    idx = z[np.abs(z) > thr].index
    out = df.copy()
    out.loc[idx, col] = np.nan
    return out, f"Set {len(idx)} value(s) in '{col}' with |robust z| > {thr} ({method}{', window ' + str(window) if method == 'hampel' else ''}) to missing (rows assumed in time order)."


def op_interpolate(df: pd.DataFrame, p: dict) -> tuple[pd.DataFrame, str]:
    col, limit = p["column"], int(p.get("limit", 3))
    s = numeric(df, col)
    before = int(s.isna().sum())
    out = df.copy()
    out[col] = s.interpolate(method="linear", limit=limit, limit_area="inside")
    return out, f"Linearly interpolated '{col}' across gaps of at most {limit} sample(s): {before - int(out[col].isna().sum())} value(s) filled."


def op_sort_time(df: pd.DataFrame, p: dict) -> tuple[pd.DataFrame, str]:
    tc = p["time_col"]
    require_columns(df, [tc])
    t = pd.to_datetime(df[tc], errors="coerce", utc=True)
    out = df.assign(**{tc: t}).dropna(subset=[tc]).sort_values(tc)
    return out.reset_index(drop=True), f"Parsed '{tc}' as UTC, dropped {len(df) - len(out)} unparseable timestamp(s) and sorted chronologically."


def op_resample(df: pd.DataFrame, p: dict) -> tuple[pd.DataFrame, str]:
    tc, rule, agg = p["time_col"], p.get("rule", "1h"), p.get("agg", "mean")
    if agg not in {"mean", "median", "min", "max", "first", "last", "sum"}:
        raise AnalysisError("Unsupported aggregation.")
    require_columns(df, [tc])
    t = pd.to_datetime(df[tc], errors="coerce", utc=True)
    num = df.drop(columns=[tc]).apply(pd.to_numeric, errors="coerce")
    num.index = t
    num = num[num.index.notna()]
    try:
        out = getattr(num.resample(rule), agg)()
    except (ValueError, TypeError) as exc:
        raise AnalysisError(f"Invalid resampling rule '{rule}'.") from exc
    out = out.reset_index().rename(columns={"index": tc})
    return out, f"Resampled to a regular '{rule}' grid using {agg}; empty intervals left missing (no interpolation). Rows: {len(df)} → {len(out)}."


def op_unit_convert(df: pd.DataFrame, p: dict) -> tuple[pd.DataFrame, str]:
    col, factor, offset = p["column"], float(p.get("factor", 1.0)), float(p.get("offset", 0.0))
    new = p.get("new_name") or col
    out = df.copy()
    out[new] = numeric(df, col) * factor + offset
    return out, f"Converted '{col}' → '{new}' as value × {factor} + {offset} ({p.get('from_unit', '?')} → {p.get('to_unit', '?')})."


def op_select_columns(df: pd.DataFrame, p: dict) -> tuple[pd.DataFrame, str]:
    cols = p["columns"]
    require_columns(df, cols)
    return df[cols].copy(), f"Kept {len(cols)} column(s): {', '.join(cols)}."


def op_rename_column(df: pd.DataFrame, p: dict) -> tuple[pd.DataFrame, str]:
    require_columns(df, [p["column"]])
    if p["new_name"] in df.columns:
        raise AnalysisError("A column with that name already exists.")
    return df.rename(columns={p["column"]: p["new_name"]}), f"Renamed '{p['column']}' to '{p['new_name']}'."


OPERATIONS = {
    "drop_duplicates": op_drop_duplicates,
    "flag_outliers_to_missing": op_flag_outliers_to_missing,
    "interpolate": op_interpolate,
    "sort_time": op_sort_time,
    "resample": op_resample,
    "unit_convert": op_unit_convert,
    "select_columns": op_select_columns,
    "rename_column": op_rename_column,
}


def apply_operations(df: pd.DataFrame, ops: list[dict]) -> tuple[pd.DataFrame, list[dict]]:
    history = []
    for op in ops:
        name = op.get("operation")
        fn = OPERATIONS.get(name)
        if not fn:
            raise AnalysisError(f"Unknown operation '{name}'.")
        params = op.get("params", {})
        try:
            df, summary = fn(df, params)
        except KeyError as exc:
            raise AnalysisError(f"Operation '{name}' is missing parameter {exc}.") from exc
        history.append({"operation": name, "params": params, "summary": summary})
    return df, history
