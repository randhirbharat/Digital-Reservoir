"""Signal processing: every intermediate stage is returned so users can compare original, baseline-corrected,
filtered and processed signals, with the parameters used for each operation."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import signal as sps

from .common import AnalysisError, numeric, series_payload, time_index, to_jsonable


def _sampling(idx: pd.Index) -> tuple[float, str]:
    """Return sampling frequency in Hz and the median interval description."""
    if isinstance(idx, pd.DatetimeIndex):
        d = np.diff(idx.asi8) / 1e9
        dt = float(np.median(d)) if len(d) else 0.0
    else:
        d = np.diff(np.asarray(idx, float))
        dt = float(np.median(d)) if len(d) else 0.0
    if dt <= 0:
        raise AnalysisError("Cannot determine a positive sampling interval.")
    return 1.0 / dt, f"{dt:g} s"


def run(df: pd.DataFrame, column: str, time_col: str | None = None, x_col: str | None = None, operations: list[dict] | None = None,
        fs_hz: float | None = None, spectra: bool = True, wavelet: bool = False, stl_period: int | None = None, max_points: int = 1500) -> dict:
    """Apply a pipeline of operations to one column.

    operations: list of {"op": name, ...params}. Supported: baseline, detrend, moving_average, butterworth, fill_gaps.
    Butterworth cut-offs are in Hz (use fs_hz or the sampling interval to interpret them).
    """
    operations = operations or []
    warnings: list[str] = []
    if time_col:
        d = time_index(df, time_col)
    elif x_col:
        d = df.set_index(pd.to_numeric(df[x_col], errors="coerce")).drop(columns=[x_col])
        d = d[d.index.notna()].sort_index()
    else:
        d = df.reset_index(drop=True)
    s = numeric(d, column)
    if fs_hz is None:
        if time_col or x_col:
            fs_hz, interval = _sampling(d.index)
        else:
            raise AnalysisError("Provide a time/x column or the sampling frequency.")
    if s.isna().any():
        warnings.append(f"{int(s.isna().sum())} missing value(s); filters require gap-free data, so gaps are linearly interpolated inside the filter stage only (flagged).")
    stages = [{"name": "Original", "op": None, "params": {}, "values": s.to_numpy(float)}]
    cur = s.to_numpy(float).copy()
    for op in operations:
        name = op.get("op")
        p = {k: v for k, v in op.items() if k != "op"}
        x = cur.copy()
        finite = np.isfinite(x)
        if name == "baseline":
            mode = p.get("mode", "first_n")
            if mode == "first_n":
                n = int(p.get("n", 50))
                ref = float(np.nanmean(x[:n]))
            elif mode == "mean":
                ref = float(np.nanmean(x))
            elif mode == "value":
                ref = float(p.get("value", 0.0))
            else:
                raise AnalysisError("baseline mode must be first_n, mean or value")
            x = x - ref
            p["reference_value"] = ref
            label = "Baseline-corrected"
        elif name == "detrend":
            kind = p.get("type", "linear")
            if kind not in {"linear", "constant"}:
                raise AnalysisError("detrend type must be linear or constant")
            xi = np.interp(np.arange(len(x)), np.flatnonzero(finite), x[finite])
            x = sps.detrend(xi, type=kind)
            x[~finite] = np.nan
            label = "Detrended"
        elif name == "moving_average":
            w = int(p.get("window", 5))
            if w < 1 or w > len(x):
                raise AnalysisError("window must be between 1 and the series length")
            x = pd.Series(x).rolling(w, center=bool(p.get("center", True)), min_periods=1).mean().to_numpy()
            label = f"Moving average (w={w})"
        elif name == "butterworth":
            btype = p.get("btype", "lowpass")
            order = int(p.get("order", 4))
            nyq = fs_hz / 2
            if btype in ("lowpass", "highpass"):
                wn = float(p["cutoff_hz"])
                if not 0 < wn < nyq:
                    raise AnalysisError(f"Cut-off must be between 0 and Nyquist ({nyq:g} Hz).")
            elif btype == "bandpass":
                wn = [float(p["low_hz"]), float(p["high_hz"])]
                if not 0 < wn[0] < wn[1] < nyq:
                    raise AnalysisError(f"Band edges must satisfy 0 < low < high < Nyquist ({nyq:g} Hz).")
            else:
                raise AnalysisError("btype must be lowpass, highpass or bandpass")
            if not 1 <= order <= 10:
                raise AnalysisError("order must be between 1 and 10")
            sos = sps.butter(order, wn, btype=btype, fs=fs_hz, output="sos")
            xi = np.interp(np.arange(len(x)), np.flatnonzero(finite), x[finite])
            if len(xi) <= 3 * (2 * len(sos) + 1):
                raise AnalysisError("Series too short for this filter order.")
            x = sps.sosfiltfilt(sos, xi)
            x[~finite] = np.nan
            p.update({"zero_phase": True, "implementation": "scipy.signal.butter (SOS) + sosfiltfilt", "fs_hz": fs_hz})
            label = f"Butterworth {btype}"
        else:
            raise AnalysisError(f"Unknown signal operation '{name}'.")
        cur = x
        stages.append({"name": label, "op": name, "params": p, "values": x})
    stages[-1]["name"] = stages[-1]["name"] if len(stages) == 1 else stages[-1]["name"] + " (processed output)"
    result: dict = {
        "method": "Signal processing pipeline", "column": column, "fs_hz": fs_hz, "warnings": warnings,
        "stages": [{"name": st["name"], "op": st["op"], "params": st["params"], "series": series_payload(d.index, st["values"], max_points),
                    "stats": {"mean": np.nanmean(st["values"]), "std": np.nanstd(st["values"])}} for st in stages],
    }
    if spectra:
        result["spectra"] = {"original": spectrum(stages[0]["values"], fs_hz), "processed": spectrum(stages[-1]["values"], fs_hz)}
    if wavelet:
        result["wavelet"] = cwt(stages[-1]["values"], fs_hz)
    if stl_period:
        result["stl"] = stl(pd.Series(stages[0]["values"], index=d.index), stl_period, max_points)
    return to_jsonable(result)


def spectrum(x: np.ndarray, fs: float, nperseg: int | None = None) -> dict:
    """One-sided FFT amplitude and Welch PSD (Hann window, 50 % overlap)."""
    x = np.asarray(x, float)
    finite = np.isfinite(x)
    if finite.sum() < 8:
        return {"note": "Too few samples for spectral analysis."}
    xi = np.interp(np.arange(len(x)), np.flatnonzero(finite), x[finite])
    xi = xi - xi.mean()
    n = len(xi)
    amp = np.abs(np.fft.rfft(xi)) * 2 / n
    f = np.fft.rfftfreq(n, d=1 / fs)
    nps = nperseg or min(n, max(64, 2 ** int(np.log2(max(8, n // 8)))))
    fw, pxx = sps.welch(xi, fs=fs, window="hann", nperseg=nps, noverlap=nps // 2)
    step = max(1, len(f) // 1500)
    peak = int(np.argmax(pxx[1:]) + 1) if len(pxx) > 1 else 0
    return {"fft": {"f": f[::step], "amplitude": amp[::step]}, "psd": {"f": fw, "pxx": pxx, "nperseg": nps, "window": "hann", "overlap": 0.5},
            "dominant_frequency_hz": fw[peak] if len(fw) else None}


def cwt(x: np.ndarray, fs: float, n_scales: int = 48, max_time: int = 400) -> dict:
    """Continuous wavelet transform (Morlet) magnitude, decimated for display."""
    import pywt

    x = np.asarray(x, float)
    finite = np.isfinite(x)
    xi = np.interp(np.arange(len(x)), np.flatnonzero(finite), x[finite]) if (~finite).any() else x
    xi = xi - xi.mean()
    scales = np.geomspace(2, max(4, len(xi) / 8), n_scales)
    coef, freqs = pywt.cwt(xi, scales, "morl", sampling_period=1 / fs)
    step = max(1, coef.shape[1] // max_time)
    return {"wavelet": "morl", "freqs_hz": freqs, "time_step_samples": step, "magnitude": np.abs(coef[:, ::step])}


def stl(s: pd.Series, period: int, max_points: int = 1500) -> dict:
    from statsmodels.tsa.seasonal import STL

    if period < 2 or len(s.dropna()) < 2 * period:
        raise AnalysisError("STL requires at least two full periods of data.")
    filled = s.interpolate(limit_direction="both")
    r = STL(filled.to_numpy(), period=period, robust=True).fit()
    return {"method": "STL (robust)", "period": period, "trend": series_payload(s.index, r.trend, max_points),
            "seasonal": series_payload(s.index, r.seasonal, max_points), "remainder": series_payload(s.index, r.resid, max_points)}
