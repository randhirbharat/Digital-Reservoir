"use client";
import { useState } from "react";
import { AnalysisLayout, useRunner } from "@/components/AnalysisLayout";
import { CheckList, Field, Input, Select } from "@/components/ui";

const KINDS = [
  { value: "descriptive", label: "Descriptive statistics" }, { value: "correlation", label: "Correlation matrix" }, { value: "regression", label: "Linear / multiple / polynomial regression" },
  { value: "pca", label: "Principal component analysis" }, { value: "factor", label: "Factor analysis" }, { value: "timeseries", label: "Time-series diagnostics (ACF, PACF, ADF)" }, { value: "hypothesis", label: "Hypothesis test" },
];

export default function StatsPage() {
  const runner = useRunner();
  const [kind, setKind] = useState("regression");
  const [cols, setCols] = useState<string[]>([]), [target, setTarget] = useState(""), [degree, setDegree] = useState(1), [method, setMethod] = useState("pearson");
  const [nFactors, setNFactors] = useState(2), [test, setTest] = useState("welch_t"), [a, setA] = useState(""), [b, setB] = useState("");
  const multi = ["descriptive", "correlation", "pca", "factor"].includes(kind) || kind === "regression";
  return (
    <AnalysisLayout title="Statistics & PCA" runner={runner} submitLabel="Run analysis"
      lead="Descriptive statistics, correlation, regression with diagnostics and prediction intervals, PCA, factor analysis, autocorrelation and hypothesis tests. Diagnostics flag violated assumptions (autocorrelation, heteroscedasticity, multicollinearity)."
      onPicked={(d) => { setCols(d.numeric.slice(0, 4)); setTarget(d.numeric[0] ?? ""); setA(d.numeric[0] ?? ""); setB(d.numeric[1] ?? ""); }}
      canSubmit={(d) => !!d.versionId && (kind === "timeseries" || kind === "hypothesis" ? !!a : kind === "regression" ? !!target && cols.filter((c) => c !== target).length > 0 : cols.length > (kind === "descriptive" ? 0 : 1))}
      onSubmit={(d) => {
        const tc = d.dataset?.time_column || null;
        const params: Record<string, unknown> =
          kind === "regression" ? { target, features: cols.filter((c) => c !== target), polynomial_degree: degree, time_col: tc } :
          kind === "correlation" ? { columns: cols, method } : kind === "pca" ? { columns: cols, standardize: true, time_col: tc } : kind === "factor" ? { columns: cols, n_factors: nFactors } :
          kind === "timeseries" ? { column: a, time_col: tc } : kind === "hypothesis" ? { test, a, b } : { columns: cols };
        runner.exec(kind, { dataset_version_id: d.versionId, params });
      }}
      form={(d) => (
        <>
          <Field label="Analysis"><Select value={kind} onChange={(e) => setKind(e.target.value)} options={KINDS} /></Field>
          {kind === "regression" ? <Field label="Response (y)"><Select value={target} onChange={(e) => setTarget(e.target.value)} options={d.numeric.map((c) => ({ value: c, label: c }))} /></Field> : null}
          {multi ? <CheckList label={kind === "regression" ? "Explanatory variables (x)" : "Variables"} options={d.numeric.filter((c) => kind !== "regression" || c !== target)} value={cols} onChange={setCols} /> : null}
          {kind === "regression" ? <Field label="Polynomial degree"><Select value={String(degree)} onChange={(e) => setDegree(Number(e.target.value))} options={[1, 2, 3, 4, 5].map((v) => ({ value: String(v), label: v === 1 ? "1 (linear)" : String(v) }))} /></Field> : null}
          {kind === "correlation" ? <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)} options={["pearson", "spearman", "kendall"].map((m) => ({ value: m, label: m }))} /></Field> : null}
          {kind === "factor" ? <Field label="Number of factors"><Input type="number" min={1} value={nFactors} onChange={(e) => setNFactors(Number(e.target.value))} /></Field> : null}
          {kind === "timeseries" || kind === "hypothesis" ? <Field label={kind === "hypothesis" ? "Variable A" : "Variable"}><Select value={a} onChange={(e) => setA(e.target.value)} options={d.numeric.map((c) => ({ value: c, label: c }))} /></Field> : null}
          {kind === "hypothesis" ? <>
            <Field label="Test"><Select value={test} onChange={(e) => setTest(e.target.value)} options={[{ value: "welch_t", label: "Welch two-sample t-test" }, { value: "paired_t", label: "Paired t-test" }, { value: "mann_whitney", label: "Mann–Whitney U" }, { value: "ks", label: "Two-sample Kolmogorov–Smirnov" }, { value: "shapiro", label: "Shapiro–Wilk normality" }, { value: "one_sample_t", label: "One-sample t-test (μ = 0)" }]} /></Field>
            {!["shapiro", "one_sample_t"].includes(test) ? <Field label="Variable B"><Select value={b} onChange={(e) => setB(e.target.value)} options={d.numeric.map((c) => ({ value: c, label: c }))} /></Field> : null}
          </> : null}
        </>
      )} />
  );
}
