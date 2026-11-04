from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from dr_analytics import anomaly, dhi, hst, io, ml, quality, signal_proc, stats
from dr_analytics.common import AnalysisError, lttb, metrics

DATA = Path(__file__).resolve().parents[3] / "datasets" / "demo_gravity_dam_daily.csv"


@pytest.fixture(scope="module")
def raw():
    df, rep = io.read_table(DATA.read_bytes(), DATA.name)
    return df


def test_read_and_profile(raw):
    df, rep = io.read_table(DATA.read_bytes(), DATA.name)
    assert rep["rows"] == 1098 and rep["header_comments"][0].startswith("# SYNTHETIC")
    cols = io.profile_columns(df)
    assert io.guess_time_column(cols) == "timestamp"
    assert {c["name"]: c["kind"] for c in cols}["PL01_disp_mm"] == "numeric"


def test_reject_bad_files():
    with pytest.raises(AnalysisError):
        io.read_table(b"\x00\x01", "x.exe")
    with pytest.raises(AnalysisError):
        io.read_table(b"# only comment\n", "a.csv")


def test_quality_detects_injected_issues(raw):
    q = quality.assess(raw, "timestamp")
    disp = next(c for c in q["columns"] if c["column"] == "PL01_disp_mm")
    assert disp["missing"] == 6
    assert q["duplicate_rows"] == 3 and q["duplicate_timestamps"] == 3
    assert disp["outliers"] >= 1 and 250 in disp["outlier_rows"]


def test_operations_do_not_mutate(raw):
    before = raw.copy()
    out, hist = quality.apply_operations(raw, [{"operation": "drop_duplicates"}, {"operation": "sort_time", "params": {"time_col": "timestamp"}},
                                              {"operation": "resample", "params": {"time_col": "timestamp", "rule": "7D"}}])
    pd.testing.assert_frame_equal(raw, before)
    assert len(out) < len(raw) and len(hist) == 3 and "Resampled" in hist[-1]["summary"]


def test_signal_pipeline_butterworth_reduces_noise():
    t = np.arange(2000) / 100.0
    x = np.sin(2 * np.pi * 1.0 * t) + 0.5 * np.sin(2 * np.pi * 20 * t)
    df = pd.DataFrame({"t": t, "x": x})
    r = signal_proc.run(df, "x", x_col="t", operations=[{"op": "baseline", "mode": "mean"}, {"op": "butterworth", "btype": "lowpass", "cutoff_hz": 5, "order": 4}])
    assert abs(r["fs_hz"] - 100) < 1e-6
    assert len(r["stages"]) == 3 and r["stages"][2]["params"]["zero_phase"]
    assert r["stages"][2]["stats"]["std"] == pytest.approx(np.std(np.sin(2 * np.pi * t)), rel=0.03)
    assert abs(r["spectra"]["original"]["dominant_frequency_hz"] - 1.0) < 0.3
    with pytest.raises(AnalysisError):
        signal_proc.run(df, "x", x_col="t", operations=[{"op": "butterworth", "cutoff_hz": 80}])


def test_regression_and_pca(raw):
    rng = np.random.default_rng(3)
    x = rng.uniform(0, 10, 400)
    known = pd.DataFrame({"x": x, "y": 2.0 + 0.45 * x + rng.normal(0, 0.3, 400)})
    r = stats.regression(known, "y", ["x"])
    c = next(c for c in r["coefficients"] if c["term"] == "x")
    assert c["ci_low"] < 0.45 < c["ci_high"] and r["fit"]["R2"] > 0.9
    p = stats.pca(raw, ["PL01_disp_mm", "reservoir_level_m", "PZ03_head_m", "V02_seepage_Ls"], time_col="timestamp")
    assert p["cumulative"][-1] == pytest.approx(1.0) and p["explained_variance_ratio"][0] > 0.5


def test_hst_separates_calibration_and_validation(raw):
    clean, _ = quality.apply_operations(raw, [{"operation": "drop_duplicates"}, {"operation": "flag_outliers_to_missing", "params": {"column": "PL01_disp_mm"}}])
    r = hst.fit(clean, "timestamp", "PL01_disp_mm", "reservoir_level_m", degree=2, harmonics=1, time_terms=["log"], calibration_fraction=0.75)
    assert r["periods"]["n_calibration"] > r["periods"]["n_validation"] > 0
    assert r["periods"]["calibration"][1] < r["periods"]["validation"][0]
    # generator noise σ = 0.12 mm: a correct model should be close to that in both periods
    assert r["metrics"]["calibration"]["RMSE"] < 0.2 and r["metrics"]["validation"]["RMSE"] < 0.3
    assert 0.8 <= r["prediction_interval_coverage_validation"] <= 1.0
    # Hmax/Hmin come from calibration only
    assert "calibration period" in r["definitions"]["h"]
    # Model state reproduces predictions
    st = r["model_state"]
    t = pd.to_datetime(clean["timestamp"], utc=True)
    yhat = hst.predict(st, pd.DatetimeIndex(t[:5]), clean["reservoir_level_m"][:5].to_numpy())
    assert np.allclose(yhat, r["series"]["predicted"]["y"][:5], atol=1e-6)


def test_ml_compare_chronological(raw):
    clean, _ = quality.apply_operations(raw, [{"operation": "drop_duplicates"}])
    r = ml.compare(clean, "PL01_disp_mm", ["reservoir_level_m", "air_temp_C"], [{"model": "linear"}, {"model": "random_forest", "params": {"n_estimators": 50}}, {"model": "lstm"}],
                   time_col="timestamp", scheme="rolling_origin", n_folds=3, seasonal_features=True, trend_feature=True)
    assert r["validation"]["n_splits"] == 3
    done = [x for x in r["results"] if x["status"] == "completed"]
    assert len(done) == 2 and any(x["status"] == "unavailable" for x in r["results"])
    for res in done:
        for f in res["folds"]:
            assert f["calibration_period"][1] < f["validation_period"][0]
        assert "MAPE_percent" not in res["validation"]  # displacement crosses zero
    assert r["ranking"][0]["validation_RMSE"] <= r["ranking"][-1]["validation_RMSE"]


def test_anomaly_and_changepoint():
    rng = np.random.default_rng(1)
    x = np.r_[rng.normal(0, 1, 300), rng.normal(3, 1, 200)]
    df = pd.DataFrame({"t": pd.date_range("2024-01-01", periods=500, freq="D", tz="UTC"), "x": x})
    cp = anomaly.change_points(df, "x", time_col="t")
    assert any(abs((pd.Timestamp(c) - df.t[300]).days) < 10 for c in cp["change_points"])
    cs = anomaly.cusum(df, "x", time_col="t", baseline_fraction=0.4)
    assert cs["first_alarm"] is not None and pd.Timestamp(cs["first_alarm"]) >= df.t[300]
    mv = anomaly.multivariate(df.assign(y=df.x * 0.5 + rng.normal(0, 0.1, 500)), ["x", "y"], time_col="t")
    assert mv["n_flags"] >= 0


def test_ahp_known_example_and_dhi():
    a = dhi.ahp_weights([[1, 3, 5], [1 / 3, 1, 3], [1 / 5, 1 / 3, 1]])
    assert a["weights"][0] == pytest.approx(0.637, abs=0.01) and a["consistent"]
    with pytest.raises(AnalysisError):
        dhi.compute([{"name": "a", "value": 1, "ref_good": 0, "ref_poor": 2}])  # no weights → refused
    r = dhi.compute([{"name": "a", "value": 0.5, "ref_good": 0, "ref_poor": 2}, {"name": "b", "value": 10, "ref_good": 10, "ref_poor": 20}], weights=[1, 1])
    assert r["index"] == pytest.approx(0.5 * 0.75 + 0.5 * 1.0)
    assert r["classification"].startswith("Unclassified")


def test_helpers():
    x = np.arange(10000.0); y = np.sin(x / 100)
    idx = lttb(x, y, 500)
    assert len(idx) == 500 and idx[0] == 0 and idx[-1] == 9999
    m = metrics(np.array([1.0, 2.0, 3.0]), np.array([1.0, 2.0, 4.0]))
    assert m["MAE"] == pytest.approx(1 / 3) and "MAPE_percent" in m
