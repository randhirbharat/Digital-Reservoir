"""Machine-learning model library with leakage-resistant, time-respecting validation.

* Splits are chronological. Shuffled cross-validation is not offered for time-indexed data.
* All preprocessing (scaling) lives inside a scikit-learn Pipeline fitted on calibration data only.
* Prediction intervals use split-conformal calibration on the last part of the calibration window.
* Every model in a comparison sees exactly the same splits.
"""
from __future__ import annotations

import time

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.linear_model import Lasso, LinearRegression, Ridge
from sklearn.neighbors import KNeighborsRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR
from sklearn.tree import DecisionTreeRegressor

from .common import AnalysisError, metrics, numeric, series_payload, time_index, to_jsonable

try:  # optional dependency
    from xgboost import XGBRegressor
except Exception:  # noqa: BLE001
    XGBRegressor = None


def _xgb(**p):
    if XGBRegressor is None:
        raise AnalysisError("XGBoost is not installed on this server.")
    return XGBRegressor(**{"n_estimators": 400, "learning_rate": 0.05, "max_depth": 4, "subsample": 0.8, "random_state": 42, "n_jobs": 2, **p})


# name: (factory, default params, needs_scaling, description, parameter schema)
MODEL_LIBRARY: dict[str, dict] = {
    "linear": {"label": "Linear regression", "factory": lambda **p: LinearRegression(), "scale": False, "params": {}, "family": "classical"},
    "ridge": {"label": "Ridge", "factory": lambda **p: Ridge(alpha=float(p.get("alpha", 1.0))), "scale": True, "params": {"alpha": 1.0}, "family": "classical"},
    "lasso": {"label": "Lasso", "factory": lambda **p: Lasso(alpha=float(p.get("alpha", 0.01)), max_iter=20000), "scale": True, "params": {"alpha": 0.01}, "family": "classical"},
    "svr": {"label": "Support vector regression (RBF)", "factory": lambda **p: SVR(C=float(p.get("C", 10.0)), epsilon=float(p.get("epsilon", 0.05)), gamma="scale"), "scale": True, "params": {"C": 10.0, "epsilon": 0.05}, "family": "classical"},
    "knn": {"label": "K-nearest neighbours", "factory": lambda **p: KNeighborsRegressor(n_neighbors=int(p.get("n_neighbors", 9)), weights="distance"), "scale": True, "params": {"n_neighbors": 9}, "family": "classical"},
    "tree": {"label": "Decision tree", "factory": lambda **p: DecisionTreeRegressor(max_depth=int(p.get("max_depth", 8)), min_samples_leaf=int(p.get("min_samples_leaf", 5)), random_state=42), "scale": False, "params": {"max_depth": 8, "min_samples_leaf": 5}, "family": "classical"},
    "random_forest": {"label": "Random forest", "factory": lambda **p: RandomForestRegressor(n_estimators=int(p.get("n_estimators", 300)), max_depth=p.get("max_depth"), min_samples_leaf=int(p.get("min_samples_leaf", 3)), random_state=42, n_jobs=2), "scale": False, "params": {"n_estimators": 300, "max_depth": None, "min_samples_leaf": 3}, "family": "ensemble"},
    "gradient_boosting": {"label": "Gradient boosting", "factory": lambda **p: GradientBoostingRegressor(n_estimators=int(p.get("n_estimators", 400)), learning_rate=float(p.get("learning_rate", 0.05)), max_depth=int(p.get("max_depth", 3)), subsample=float(p.get("subsample", 0.8)), random_state=42), "scale": False, "params": {"n_estimators": 400, "learning_rate": 0.05, "max_depth": 3, "subsample": 0.8}, "family": "ensemble"},
    "xgboost": {"label": "XGBoost", "factory": lambda **p: _xgb(**{k: v for k, v in p.items() if k in {"n_estimators", "learning_rate", "max_depth", "subsample"}}), "scale": False, "params": {"n_estimators": 400, "learning_rate": 0.05, "max_depth": 4, "subsample": 0.8}, "family": "ensemble"},
    "ann": {"label": "Artificial neural network (MLP)", "factory": lambda **p: MLPRegressor(hidden_layer_sizes=tuple(p.get("hidden_layers", [32, 16])), alpha=float(p.get("alpha", 1e-3)), max_iter=int(p.get("max_iter", 2000)), early_stopping=True, random_state=42), "scale": True, "params": {"hidden_layers": [32, 16], "alpha": 0.001, "max_iter": 2000}, "family": "neural"},
}

PENDING_MODELS = {
    "lstm": "LSTM — requires the PyTorch runtime (Stage 6).",
    "gru": "GRU — requires the PyTorch runtime (Stage 6).",
    "cnn": "1-D CNN — requires the PyTorch runtime (Stage 6).",
    "autoencoder": "Autoencoder — requires the PyTorch runtime (Stage 6).",
    "pinn": "Physics-informed neural network — requires the PyTorch runtime (Stage 6).",
}


def library() -> dict:
    return {"available": {k: {"label": v["label"], "family": v["family"], "default_params": v["params"], "scaled_inputs": v["scale"]}
                          for k, v in MODEL_LIBRARY.items() if not (k == "xgboost" and XGBRegressor is None)},
            "pending": PENDING_MODELS}


def _pipeline(name: str, params: dict) -> Pipeline:
    spec = MODEL_LIBRARY.get(name)
    if not spec:
        raise AnalysisError(f"Unknown model '{name}'.")
    steps = [("scale", StandardScaler())] if spec["scale"] else []
    steps.append(("model", spec["factory"](**(params or {}))))
    return Pipeline(steps)


def _features(d: pd.DataFrame, target: str, features: list[str], lags: dict[str, list[int]] | None, seasonal: bool, trend: bool) -> pd.DataFrame:
    cols = {f: numeric(d, f) for f in features}
    for col, ls in (lags or {}).items():
        base = numeric(d, col)
        for L in ls:
            if L <= 0:
                raise AnalysisError("Lags must be positive (past values only).")
            cols[f"{col}_lag{L}"] = base.shift(L)
    if seasonal and isinstance(d.index, pd.DatetimeIndex):
        s = 2 * np.pi * d.index.day_of_year.to_numpy() / 365.25
        cols["sin_doy"] = pd.Series(np.sin(s), index=d.index)
        cols["cos_doy"] = pd.Series(np.cos(s), index=d.index)
    if trend and isinstance(d.index, pd.DatetimeIndex):
        cols["t_years"] = pd.Series((d.index - d.index[0]).total_seconds() / (365.25 * 86400), index=d.index)
    X = pd.DataFrame(cols, index=d.index)
    if target in X.columns:
        raise AnalysisError("The target cannot also be an input (use lagged target values instead).")
    return X


def _splits(n: int, scheme: str, calibration_fraction: float, n_folds: int, test_fraction: float) -> list[tuple[np.ndarray, np.ndarray]]:
    if scheme == "holdout":
        cut = int(n * calibration_fraction)
        return [(np.arange(cut), np.arange(cut, n))]
    if scheme == "frozen_test":
        cut = int(n * (1 - test_fraction))
        return [(np.arange(cut), np.arange(cut, n))]
    if scheme == "rolling_origin":
        if n_folds < 2:
            raise AnalysisError("Rolling-origin evaluation needs at least 2 folds.")
        first = int(n * 0.5)
        block = (n - first) // n_folds
        if block < 5:
            raise AnalysisError("Too few observations for this many folds.")
        return [(np.arange(first + k * block), np.arange(first + k * block, first + (k + 1) * block if k < n_folds - 1 else n)) for k in range(n_folds)]
    raise AnalysisError("Validation scheme must be holdout, rolling_origin or frozen_test.")


def compare(df: pd.DataFrame, target: str, features: list[str], models: list[dict], *, time_col: str | None = None,
            scheme: str = "holdout", calibration_fraction: float = 0.8, n_folds: int = 5, test_fraction: float = 0.2,
            lags: dict[str, list[int]] | None = None, seasonal_features: bool = False, trend_feature: bool = False,
            interval_alpha: float = 0.1, importance: bool = True, max_points: int = 1500) -> dict:
    if not models:
        raise AnalysisError("Select at least one model.")
    if not features and not lags and not seasonal_features and not trend_feature:
        raise AnalysisError("Select at least one input variable.")
    d = time_index(df, time_col) if time_col else df.reset_index(drop=True)
    if not time_col:
        warning_order = ["No time column given: rows are assumed to be in chronological order."]
    else:
        warning_order = []
    y = numeric(d, target)
    X = _features(d, target, features, lags, seasonal_features, trend_feature)
    data = pd.concat([X, y.rename("__y")], axis=1).dropna()
    if len(data) < 40:
        raise AnalysisError("At least 40 complete observations are required.")
    Xv, yv, idx = data.drop(columns="__y"), data["__y"].to_numpy(), data.index
    splits = _splits(len(data), scheme, calibration_fraction, n_folds, test_fraction)
    results = []
    for spec in models:
        name, params = spec.get("model"), spec.get("params") or {}
        if name in PENDING_MODELS:
            results.append({"model": name, "label": name.upper(), "status": "unavailable", "note": PENDING_MODELS[name]})
            continue
        base = _pipeline(name, params)
        folds, preds_val, t_fit = [], np.full(len(data), np.nan), 0.0
        lo_val, hi_val = np.full(len(data), np.nan), np.full(len(data), np.nan)
        cal_metrics = None
        final = None
        for k, (tr, te) in enumerate(splits):
            # split-conformal: hold back the last 20 % of the calibration window to size the interval
            n_conf = max(5, int(0.2 * len(tr)))
            fit_idx, conf_idx = tr[:-n_conf], tr[-n_conf:]
            m = clone(base)
            t1 = time.perf_counter()
            m.fit(Xv.iloc[fit_idx], yv[fit_idx])
            t_fit += time.perf_counter() - t1
            q_level = min(1.0, np.ceil((n_conf + 1) * (1 - interval_alpha)) / n_conf)
            q = float(np.quantile(np.abs(yv[conf_idx] - m.predict(Xv.iloc[conf_idx])), q_level))
            # refit on the full calibration window for point predictions
            m_full = clone(base).fit(Xv.iloc[tr], yv[tr])
            p = m_full.predict(Xv.iloc[te])
            preds_val[te], lo_val[te], hi_val[te] = p, p - q, p + q
            fm = metrics(yv[te], p)
            fm.update({"fold": k + 1, "calibration_period": [idx[tr[0]], idx[tr[-1]]], "validation_period": [idx[te[0]], idx[te[-1]]],
                       "interval_halfwidth": q, "interval_coverage": float(np.mean((yv[te] >= p - q) & (yv[te] <= p + q)))})
            folds.append(fm)
            if k == len(splits) - 1:
                cal_metrics = metrics(yv[tr], m_full.predict(Xv.iloc[tr]))
                final = (m_full, te)
        val_mask = ~np.isnan(preds_val)
        overall = metrics(yv[val_mask], preds_val[val_mask])
        overall["interval_coverage"] = float(np.mean((yv[val_mask] >= lo_val[val_mask]) & (yv[val_mask] <= hi_val[val_mask])))
        imp = None
        if importance and final is not None:
            m_full, te = final
            pi = permutation_importance(m_full, Xv.iloc[te], yv[te], n_repeats=8, random_state=42, scoring="neg_root_mean_squared_error")
            imp = sorted([{"feature": c, "importance": float(v), "std": float(s)} for c, v, s in zip(Xv.columns, pi.importances_mean, pi.importances_std)], key=lambda r: -r["importance"])
        results.append({
            "model": name, "label": MODEL_LIBRARY[name]["label"], "status": "completed", "params": {**MODEL_LIBRARY[name]["params"], **params},
            "validation": overall, "calibration_last_fold": cal_metrics, "folds": folds, "fit_time_s": t_fit, "permutation_importance": imp,
            "series": {"predicted": series_payload(idx[val_mask], preds_val[val_mask], max_points), "pi_low": series_payload(idx[val_mask], lo_val[val_mask], max_points),
                       "pi_high": series_payload(idx[val_mask], hi_val[val_mask], max_points)},
        })
    done = [r for r in results if r["status"] == "completed"]
    ranking = sorted(done, key=lambda r: r["validation"]["RMSE"])
    return to_jsonable({
        "method": "Model comparison on identical chronological splits",
        "target": target, "inputs": list(Xv.columns), "n": len(data),
        "validation": {"scheme": scheme, "n_splits": len(splits), "calibration_fraction": calibration_fraction if scheme == "holdout" else None,
                       "n_folds": n_folds if scheme == "rolling_origin" else None, "test_fraction": test_fraction if scheme == "frozen_test" else None,
                       "leakage_controls": ["chronological order preserved (no shuffling)", "scaling fitted inside each calibration window", "lag features use past values only",
                                            "conformal interval sized on held-back end of calibration window"]},
        "interval": {"method": "split-conformal", "nominal_coverage": 1 - interval_alpha},
        "ranking": [{"model": r["model"], "label": r["label"], "validation_RMSE": r["validation"]["RMSE"]} for r in ranking],
        "results": results,
        "observed": series_payload(idx, yv, max_points),
        "warnings": warning_order + (["Ranking uses validation RMSE only; calibration fit is reported but not used for ranking."]),
    })
