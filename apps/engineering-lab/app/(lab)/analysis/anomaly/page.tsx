"use client";
import { useState } from "react";
import { AnalysisLayout, useRunner } from "@/components/AnalysisLayout";
import { CheckList, Field, Input, Select } from "@/components/ui";

export default function AnomalyPage() {
  const runner = useRunner();
  const [kind, setKind] = useState("anomaly_cusum"), [col, setCol] = useState(""), [cols, setCols] = useState<string[]>([]);
  const [baseline, setBaseline] = useState(0.5), [threshold, setThreshold] = useState(3), [k, setK] = useState(0.5), [h, setH] = useState(5), [method, setMethod] = useState("mahalanobis"), [maxCp, setMaxCp] = useState(5);
  return (
    <AnalysisLayout title="Damage detection & anomaly screening" runner={runner} submitLabel="Screen data"
      lead="Statistical damage indicators: residual z-scores, CUSUM, change-point detection and multivariate novelty (Mahalanobis, isolation forest). Apply them to model residuals (e.g. HST residual exports) or raw channels. Flags are prompts for engineering review, never evidence of damage on their own."
      onPicked={(d) => { setCol(d.numeric[0] ?? ""); setCols(d.numeric.slice(0, 3)); }}
      canSubmit={(d) => !!d.versionId && (kind === "anomaly_multivariate" ? cols.length >= 2 : !!col)}
      onSubmit={(d) => {
        const tc = d.dataset?.time_column || null;
        const params = kind === "anomaly_zscore" ? { column: col, time_col: tc, threshold, baseline_fraction: baseline } : kind === "anomaly_cusum" ? { column: col, time_col: tc, k, h, baseline_fraction: baseline }
          : kind === "anomaly_changepoint" ? { column: col, time_col: tc, max_changes: maxCp } : { columns: cols, time_col: tc, method, baseline_fraction: baseline };
        runner.exec(kind, { dataset_version_id: d.versionId, params });
      }}
      form={(d) => (
        <>
          <Field label="Method"><Select value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "anomaly_cusum", label: "CUSUM (persistent shifts)" }, { value: "anomaly_zscore", label: "Baseline z-score (single exceedances)" }, { value: "anomaly_changepoint", label: "Change-point detection (mean shifts)" }, { value: "anomaly_multivariate", label: "Multivariate novelty (sensor fusion)" }]} /></Field>
          {kind === "anomaly_multivariate" ? <>
            <CheckList label="Variables" options={d.numeric} value={cols} onChange={setCols} />
            <Field label="Algorithm"><Select value={method} onChange={(e) => setMethod(e.target.value)} options={[{ value: "mahalanobis", label: "Mahalanobis distance (χ² threshold)" }, { value: "isolation_forest", label: "Isolation forest" }]} /></Field>
          </> : <Field label="Variable"><Select value={col} onChange={(e) => setCol(e.target.value)} options={d.numeric.map((c) => ({ value: c, label: c }))} /></Field>}
          {kind !== "anomaly_changepoint" ? <Field label="Baseline fraction" hint="Earliest share of the record treated as reference behaviour."><Input type="number" min={0.1} max={0.9} step={0.05} value={baseline} onChange={(e) => setBaseline(Number(e.target.value))} /></Field> : null}
          {kind === "anomaly_zscore" ? <Field label="|z| threshold"><Input type="number" step={0.1} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></Field> : null}
          {kind === "anomaly_cusum" ? <div className="grid grid-cols-2 gap-x-3"><Field label="k (σ)"><Input type="number" step={0.1} value={k} onChange={(e) => setK(Number(e.target.value))} /></Field><Field label="h (σ)"><Input type="number" step={0.5} value={h} onChange={(e) => setH(Number(e.target.value))} /></Field></div> : null}
          {kind === "anomaly_changepoint" ? <Field label="Maximum change points"><Input type="number" min={1} max={20} value={maxCp} onChange={(e) => setMaxCp(Number(e.target.value))} /></Field> : null}
          <p className="text-xs text-muted pt-1">Thresholds here are screening settings chosen by you, not validated engineering criteria.</p>
        </>
      )} />
  );
}
