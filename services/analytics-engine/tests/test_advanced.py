import io
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from PIL import Image

from dr_analytics import fragility, hybrid, io as dio, modal, vision

DATA = Path(__file__).resolve().parents[3] / "datasets"


def test_fragility_mle_recovers_generator():
    df, _ = dio.read_table((DATA / "demo_fragility_stripes.csv").read_bytes(), "f.csv")
    r = fragility.fit(df, method="mle", n_boot=150)
    # Compare with the capacities the 20 sampled records actually had (bracketed between stripes), not the population θ=0.55:
    caps = df.groupby("record_id").apply(lambda g: g.loc[g.exceeds_ds2 == 1, "pga_g"].min() - 0.05, include_groups=False)
    sample_theta = float(np.exp(np.log(caps).mean()))
    assert r["theta"] == pytest.approx(sample_theta, rel=0.1) and 0.1 < r["beta"] < 0.7
    assert r["ci_90"]["theta"][0] < r["theta"] < r["ci_90"]["theta"][1]
    ida = fragility.fit(pd.DataFrame({"cap": np.exp(np.log(0.6) + 0.35 * np.random.default_rng(1).normal(size=400))}), method="ida", capacity_col="cap", n_boot=50)
    assert ida["theta"] == pytest.approx(0.6, rel=0.05) and ida["beta"] == pytest.approx(0.35, rel=0.1)


def test_modal_identifies_two_modes():
    df, _ = dio.read_table((DATA / "demo_ambient_vibration_100Hz.csv").read_bytes(), "v.csv")
    r = modal.identify(df, ["ACC1_mg", "ACC2_mg"], time_col="time_s", f_max=20, n_modes=2)
    f = sorted(m["frequency_hz"] for m in r["modes"])
    assert f[0] == pytest.approx(3.2, abs=0.15) and f[1] == pytest.approx(7.9, abs=0.25)
    d = [m["damping_ratio_half_power"] for m in r["modes"] if m["damping_ratio_half_power"] is not None]
    assert d and all(0.003 < x < 0.15 for x in d)
    assert r["mac"][0][1] < 0.9  # distinct shapes


def test_hybrid_improves_on_missing_physics():
    t = pd.date_range("2022-01-01", periods=900, freq="D", tz="UTC")
    rng = np.random.default_rng(0)
    H = 600 + 8 * np.sin(2 * np.pi * np.arange(900) / 365)
    T = 15 + 10 * np.sin(2 * np.pi * (np.arange(900) - 30) / 365) + rng.normal(0, 2, 900)
    y = 0.3 * (H - 600) + 0.08 * np.maximum(T - 15, 0) ** 1.5 + rng.normal(0, 0.05, 900)   # thermal effect the physics part lacks
    df = pd.DataFrame({"t": t, "y": y, "H": H, "T": T})
    r = hybrid.fit(df, "t", "y", "H", ["T"], degree=2, harmonics=0, time_terms=[])
    assert r["metrics"]["hybrid_validation"]["RMSE"] < r["metrics"]["physics_only_validation"]["RMSE"]
    assert r["periods"]["calibration"][1] < r["periods"]["validation"][0]


def _synthetic_crack_image(crack=True):
    rng = np.random.default_rng(3)
    img = 0.62 + 0.06 * rng.normal(size=(400, 600))
    img += 0.05 * np.sin(np.arange(600) / 25)[None, :]
    for _ in range(40):  # pores / blobs
        y, x = rng.integers(10, 390), rng.integers(10, 590)
        img[y - 2:y + 3, x - 2:x + 3] -= 0.25
    if crack:
        xs = np.arange(60, 540)
        ys = (200 + 60 * np.sin(xs / 90) + rng.normal(0, 1.2, len(xs))).astype(int)
        for x, y in zip(xs, ys):
            img[y - 1:y + 2, x] -= 0.4
    buf = io.BytesIO()
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(buf, format="PNG")
    return buf.getvalue()


def test_crack_detection_finds_line_not_pores():
    r = vision.detect_cracks(_synthetic_crack_image(True), mm_per_pixel=0.5)
    true_len = float(np.sum(np.hypot(1, np.diff(200 + 60 * np.sin(np.arange(60, 540) / 90)))))  # drawn path ≈ 560 px
    longest = max(c["length_px"] for c in r["cracks"])
    assert r["n_candidates"] >= 1 and abs(longest - true_len) / true_len < 0.25, (longest, true_len)
    assert r["status"] == "model_output_unverified" and "length_mm" in r["cracks"][0]
    clean = vision.detect_cracks(_synthetic_crack_image(False))
    assert clean["n_candidates"] == 0
    with pytest.raises(Exception):
        vision.detect_cracks(b"not an image")
