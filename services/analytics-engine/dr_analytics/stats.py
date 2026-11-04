"""Descriptive statistics, correlation, regression with diagnostics, PCA, factor analysis, time-series diagnostics
and hypothesis tests."""
from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats as sst
from statsmodels.stats.diagnostic import het_breuschpagan
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.stattools import durbin_watson, jarque_bera

from .common import AnalysisError, metrics, numeric, require_columns, series_payload, time_index, to_jsonable


def _numeric_frame(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    require_columns(df, cols)
    return pd.DataFrame({c: numeric(df, c) for c in cols}, index=df.index)


def descriptive(df: pd.DataFrame, columns: list[str]) -> dict:
    X = _numeric_frame(df, columns)
    rows = []
    for c in columns:
        s = X[c].dropna()
        rows.append({"column": c, "n": len(s), "missing": int(X[c].isna().sum()), "mean": s.mean(), "std": s.std(), "min": s.min(),
                     "p05": s.quantile(0.05), "p25": s.quantile(0.25), "median": s.median(), "p75": s.quantile(0.75), "p95": s.quantile(0.95),
                     "max": s.max(), "skewness": sst.skew(s) if len(s) > 2 else None, "kurtosis_excess": sst.kurtosis(s) if len(s) > 3 else None})
    return to_jsonable({"method": "Descriptive statistics", "table": rows})


def correlation(df: pd.DataFrame, columns: list[str], method: str = "pearson") -> dict:
    if method not in {"pearson", "spearman", "kendall"}:
        raise AnalysisError("method must be pearson, spearman or kendall")
    X = _numeric_frame(df, columns)
    C = X.corr(method=method)
    pvals = np.full((len(columns), len(columns)), np.nan)
    fn = {"pearson": sst.pearsonr, "spearman": sst.spearmanr, "kendall": sst.kendalltau}[method]
    for i, a in enumerate(columns):
        for j, b in enumerate(columns):
            if i < j:
                pair = X[[a, b]].dropna()
                if len(pair) > 3:
                    pvals[i, j] = pvals[j, i] = fn(pair[a], pair[b])[1]
    return to_jsonable({"method": f"{method.title()} correlation (pairwise complete observations)", "columns": columns, "matrix": C.values, "p_values": pvals,
                        "note": "Correlation does not imply causation; autocorrelated series inflate apparent significance."})


def regression(df: pd.DataFrame, target: str, features: list[str], polynomial_degree: int = 1, time_col: str | None = None, alpha: float = 0.05, max_points: int = 1500) -> dict:
    """OLS (simple, multiple or polynomial) with coefficient CIs, prediction intervals and diagnostics."""
    if not features:
        raise AnalysisError("Select at least one explanatory variable.")
    if not 1 <= polynomial_degree <= 5:
        raise AnalysisError("Polynomial degree must be 1–5.")
    d = time_index(df, time_col) if time_col else df
    X = _numeric_frame(d, features)
    y = numeric(d, target)
    data = pd.concat([y.rename("__y"), X], axis=1).dropna()
    if len(data) < len(features) * polynomial_degree + 5:
        raise AnalysisError("Not enough complete observations for this model.")
    terms = {}
    for f in features:
        for k in range(1, polynomial_degree + 1):
            terms[f if k == 1 else f"{f}^{k}"] = data[f] ** k
    Xd = sm.add_constant(pd.DataFrame(terms, index=data.index))
    model = sm.OLS(data["__y"], Xd).fit()
    ci = model.conf_int(alpha)
    coefs = [{"term": t, "estimate": model.params[t], "std_error": model.bse[t], "t": model.tvalues[t], "p_value": model.pvalues[t],
              "ci_low": ci.loc[t, 0], "ci_high": ci.loc[t, 1]} for t in Xd.columns]
    pred = model.get_prediction(Xd).summary_frame(alpha=alpha)
    resid = model.resid
    bp = het_breuschpagan(resid, Xd)
    jb = jarque_bera(resid)
    vif = []
    if Xd.shape[1] > 2:
        for i, c in enumerate(Xd.columns):
            if c != "const":
                vif.append({"term": c, "VIF": float(variance_inflation_factor(Xd.values, i))})
    infl = model.get_influence()
    cooks = infl.cooks_distance[0]
    dw = durbin_watson(resid)
    warnings = []
    if dw < 1.5 or dw > 2.5:
        warnings.append(f"Durbin–Watson = {dw:.2f}: residuals are autocorrelated; standard errors and intervals are likely too narrow.")
    if bp[1] < alpha:
        warnings.append("Breusch–Pagan test indicates heteroscedastic residuals.")
    if any(v["VIF"] > 10 for v in vif):
        warnings.append("High multicollinearity (VIF > 10) — individual coefficients are unstable.")
    idx = data.index
    return to_jsonable({
        "method": "Ordinary least squares", "formula": f"{target} ~ " + " + ".join(Xd.columns.drop("const")),
        "assumptions": ["Linear in parameters", "Independent errors", "Constant error variance", "Approximately normal errors for intervals"],
        "n": int(model.nobs), "coefficients": coefs,
        "fit": {"R2": model.rsquared, "adj_R2": model.rsquared_adj, "F": model.fvalue, "F_p_value": model.f_pvalue, "AIC": model.aic, "BIC": model.bic, "sigma": float(np.sqrt(model.scale))},
        "metrics_in_sample": metrics(data["__y"].values, model.fittedvalues.values),
        "diagnostics": {"durbin_watson": dw, "breusch_pagan": {"LM": bp[0], "p_value": bp[1]}, "jarque_bera": {"JB": jb[0], "p_value": jb[1], "skew": jb[2], "kurtosis": jb[3]},
                        "vif": vif, "max_cooks_distance": float(np.max(cooks)), "n_influential_cooks_gt_4_over_n": int(np.sum(cooks > 4 / len(cooks)))},
        "warnings": warnings,
        "series": {"observed": series_payload(idx, data["__y"], max_points), "fitted": series_payload(idx, model.fittedvalues, max_points),
                   "pi_low": series_payload(idx, pred["obs_ci_lower"], max_points), "pi_high": series_payload(idx, pred["obs_ci_upper"], max_points),
                   "residuals": series_payload(idx, resid, max_points)},
        "scatter": {"x": data[features[0]].values[:: max(1, len(data) // 1500)], "y": data["__y"].values[:: max(1, len(data) // 1500)], "x_name": features[0]},
        "note": "In-sample fit statistics describe calibration only; they are not forecast performance.",
    })


def pca(df: pd.DataFrame, columns: list[str], standardize: bool = True, n_components: int | None = None, time_col: str | None = None, max_points: int = 1500) -> dict:
    from sklearn.decomposition import PCA

    if len(columns) < 2:
        raise AnalysisError("PCA needs at least two variables.")
    d = time_index(df, time_col) if time_col else df
    X = _numeric_frame(d, columns).dropna()
    if len(X) < len(columns) + 2:
        raise AnalysisError("Not enough complete observations for PCA.")
    mu, sd = X.mean(), X.std(ddof=0).replace(0, np.nan)
    if standardize and sd.isna().any():
        raise AnalysisError("A selected variable is constant; remove it before PCA.")
    Z = (X - mu) / sd if standardize else X - mu
    k = n_components or len(columns)
    p = PCA(n_components=min(k, len(columns))).fit(Z.values)
    scores = p.transform(Z.values)
    return to_jsonable({
        "method": "Principal component analysis (SVD)", "standardized": standardize, "n": len(X),
        "explained_variance_ratio": p.explained_variance_ratio_, "cumulative": np.cumsum(p.explained_variance_ratio_),
        "eigenvalues": p.explained_variance_,
        "loadings": [{"component": f"PC{i + 1}", **{c: float(v) for c, v in zip(columns, p.components_[i])}} for i in range(p.n_components_)],
        "scores": {f"PC{i + 1}": series_payload(X.index, scores[:, i], max_points) for i in range(min(3, p.n_components_))},
        "kaiser_retain": int(np.sum(p.explained_variance_ > 1)) if standardize else None,
        "note": "Standardised PCA uses the correlation matrix; components are sign-indeterminate.",
    })


def factor_analysis(df: pd.DataFrame, columns: list[str], n_factors: int = 2) -> dict:
    from sklearn.decomposition import FactorAnalysis

    X = _numeric_frame(df, columns).dropna()
    if n_factors < 1 or n_factors >= len(columns):
        raise AnalysisError("Number of factors must be at least 1 and fewer than the number of variables.")
    Z = (X - X.mean()) / X.std(ddof=0)
    fa = FactorAnalysis(n_components=n_factors, rotation="varimax").fit(Z.values)
    return to_jsonable({"method": "Factor analysis (maximum likelihood, varimax rotation)", "n": len(X),
                        "loadings": [{"variable": c, **{f"F{j + 1}": fa.components_[j, i] for j in range(n_factors)}} for i, c in enumerate(columns)],
                        "uniqueness": dict(zip(columns, fa.noise_variance_)),
                        "note": "Use only where a latent-factor interpretation is physically justified."})


def timeseries(df: pd.DataFrame, column: str, time_col: str | None = None, nlags: int = 40) -> dict:
    from statsmodels.tsa.stattools import acf, adfuller, pacf

    d = time_index(df, time_col) if time_col else df
    s = numeric(d, column).dropna()
    nl = min(nlags, len(s) // 2 - 1)
    if nl < 2:
        raise AnalysisError("Series too short.")
    a, aci = acf(s, nlags=nl, alpha=0.05)
    pa, paci = pacf(s, nlags=nl, alpha=0.05, method="ywm")
    adf = adfuller(s, autolag="AIC")
    lb = sm.stats.acorr_ljungbox(s, lags=[min(10, nl)], return_df=True)
    return to_jsonable({"method": "Autocorrelation diagnostics", "column": column, "n": len(s), "acf": a, "acf_ci": aci, "pacf": pa, "pacf_ci": paci,
                        "adf": {"statistic": adf[0], "p_value": adf[1], "lags_used": adf[2], "critical_values": adf[4],
                                "interpretation": "Unit root rejected at 5 % (stationary around mean)" if adf[1] < 0.05 else "Unit root not rejected at 5 % — possible non-stationarity"},
                        "ljung_box": {"lag": int(lb.index[0]), "Q": float(lb["lb_stat"].iloc[0]), "p_value": float(lb["lb_pvalue"].iloc[0])}})


def hypothesis_test(df: pd.DataFrame, test: str, a: str, b: str | None = None, mu: float = 0.0) -> dict:
    x = numeric(df, a).dropna()
    if test == "one_sample_t":
        r = sst.ttest_1samp(x, mu)
        desc = f"H0: mean({a}) = {mu}"
    elif test in {"welch_t", "mann_whitney", "paired_t", "ks"}:
        if not b:
            raise AnalysisError("Select a second variable.")
        y = numeric(df, b).dropna()
        if test == "welch_t":
            r = sst.ttest_ind(x, y, equal_var=False); desc = f"H0: mean({a}) = mean({b}) (Welch)"
        elif test == "mann_whitney":
            r = sst.mannwhitneyu(x, y); desc = f"H0: distributions of {a} and {b} are equal (Mann–Whitney U)"
        elif test == "ks":
            r = sst.ks_2samp(x, y); desc = f"H0: {a} and {b} come from the same distribution (two-sample KS)"
        else:
            pair = pd.concat([numeric(df, a), numeric(df, b)], axis=1).dropna()
            r = sst.ttest_rel(pair.iloc[:, 0], pair.iloc[:, 1]); desc = f"H0: mean difference {a} − {b} = 0 (paired)"
    elif test == "shapiro":
        r = sst.shapiro(x[:5000]); desc = f"H0: {a} is normally distributed (Shapiro–Wilk, ≤5000 samples)"
    else:
        raise AnalysisError("Unknown test.")
    return to_jsonable({"method": test, "hypothesis": desc, "statistic": float(r.statistic), "p_value": float(r.pvalue),
                        "note": "Tests assume independent observations; autocorrelated monitoring data violate this and overstate significance."})
