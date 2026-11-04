"""Operational modal analysis from ambient vibration (output-only).

* Welch auto-spectra per channel and peak picking with half-power damping estimates.
* Frequency-domain decomposition (FDD): SVD of the cross-spectral density matrix; peaks of the first singular value
  identify modes and the first singular vectors approximate mode shapes. MAC between identified modes.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import signal as sps

from .common import AnalysisError, numeric, to_jsonable


def _half_power(f: np.ndarray, p: np.ndarray, k: int) -> float | None:
    half = p[k] / 2  # PSD is a power quantity: half power = peak / 2
    i = k
    while i > 0 and p[i] > half:
        i -= 1
    j = k
    while j < len(p) - 1 and p[j] > half:
        j += 1
    if i == 0 or j == len(p) - 1:
        return None
    f1 = np.interp(half, [p[i], p[i + 1]], [f[i], f[i + 1]])
    f2 = np.interp(half, [p[j], p[j - 1]], [f[j], f[j - 1]])
    return float((f2 - f1) / (2 * f[k]))


def mac(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.abs(np.vdot(a, b)) ** 2 / (np.vdot(a, a).real * np.vdot(b, b).real))


def identify(df: pd.DataFrame, channels: list[str], fs_hz: float | None = None, time_col: str | None = None, f_max: float | None = None,
             n_modes: int = 4, nperseg: int | None = None, prominence: float = 0.05) -> dict:
    if not channels:
        raise AnalysisError("Select at least one acceleration channel.")
    if fs_hz is None:
        if not time_col:
            raise AnalysisError("Provide the sampling frequency or a time column in seconds.")
        t = numeric(df, time_col).to_numpy()
        fs_hz = 1.0 / float(np.median(np.diff(t)))
    X = np.column_stack([numeric(df, c).interpolate(limit_direction="both").to_numpy() for c in channels])
    X = sps.detrend(X, axis=0)
    n = X.shape[0]
    nps = nperseg or int(min(n // 8, 2 ** int(np.log2(max(256, fs_hz * 20)))))
    if nps < 64:
        raise AnalysisError("Record too short for spectral estimation.")
    f, _ = sps.welch(X[:, 0], fs=fs_hz, nperseg=nps)
    m = len(channels)
    G = np.zeros((len(f), m, m), complex)
    for i in range(m):
        for j in range(i, m):
            _, g = sps.csd(X[:, i], X[:, j], fs=fs_hz, nperseg=nps)
            G[:, i, j] = g
            G[:, j, i] = np.conj(g)
    sv = np.zeros((len(f), m))
    vec = np.zeros((len(f), m), complex)
    for k in range(len(f)):
        U, s, _ = np.linalg.svd(G[k])
        sv[k], vec[k] = s, U[:, 0]
    keep = (f > 0) & (f <= (f_max or fs_hz / 2))
    s1 = sv[:, 0]
    lg = np.log10(s1 + 1e-30)
    peaks, props = sps.find_peaks(np.where(keep, lg, lg.min()), prominence=prominence * (lg[keep].max() - lg[keep].min()))
    peaks = sorted(peaks, key=lambda k: -s1[k])[:n_modes]
    peaks.sort()
    modes = []
    for k in peaks:
        shape = vec[k] / vec[k][np.argmax(np.abs(vec[k]))]
        modes.append({"frequency_hz": float(f[k]), "damping_ratio_half_power": _half_power(f, s1, k), "shape_real": np.real(shape), "shape_abs": np.abs(shape),
                      "singular_value": float(s1[k])})
    M = [[mac(np.array(a["shape_real"]), np.array(b["shape_real"])) for b in modes] for a in modes]
    step = max(1, len(f) // 2000)
    return to_jsonable({
        "method": "Frequency-domain decomposition (FDD) with half-power damping", "fs_hz": fs_hz, "channels": channels, "n_samples": n,
        "welch": {"nperseg": nps, "window": "hann", "overlap": 0.5, "frequency_resolution_hz": fs_hz / nps},
        "spectrum": {"f": f[::step], "singular_values": sv[::step].T},
        "modes": modes, "mac": M,
        "notes": ["Half-power damping from spectral peaks is biased by frequency resolution and leakage; treat it as indicative.",
                  "Closely spaced or weakly excited modes may be missed; confirm with SSI or with independent records.",
                  "For health monitoring, track identified frequencies over time after normalising for temperature and reservoir level."],
    })
