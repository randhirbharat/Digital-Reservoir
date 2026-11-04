"use client";
import { useState } from "react";
import { AnalysisLayout, useRunner } from "@/components/AnalysisLayout";
import { CheckList, Field, Input, Select } from "@/components/ui";

export default function HybridPage() {
  const runner = useRunner();
  const [p, setP] = useState({ response_col: "", level_col: "", physics_col: "", residual_features: [] as string[], degree: 3, harmonics: 2, calibration_fraction: 0.8, n_estimators: 300, learning_rate: 0.05, max_depth: 3 });
  return (
    <AnalysisLayout title="Hybrid physics–ML model" runner={runner} submitLabel="Fit hybrid model"
      lead="A physics/statistical baseline (HST, or a supplied physics column such as a finite-element hydrostatic response) plus a gradient-boosting model of its residuals. Both parts are fitted on the calibration window only, and the physics-only and hybrid validation errors are reported side by side."
      onPicked={(d) => { const n = d.numeric; setP((q) => ({ ...q, response_col: n.find((c) => /disp|pl/i.test(c)) || n[0] || "", level_col: n.find((c) => /level|rl/i.test(c)) || n[1] || "", residual_features: n.filter((c) => /temp|tm/i.test(c)).slice(0, 2) })); }}
      canSubmit={(d) => !!(d.versionId && d.dataset?.time_column && p.response_col && p.level_col)}
      onSubmit={(d) => runner.exec("hybrid", { dataset_version_id: d.versionId, params: { ...p, time_col: d.dataset?.time_column, physics_col: p.physics_col || null, unit: d.dataset?.units[p.response_col] ?? "" } })}
      form={(d) => (
        <>
          <Field label="Response"><Select value={p.response_col} onChange={(e) => setP({ ...p, response_col: e.target.value })} options={d.numeric.map((c) => ({ value: c, label: c }))} /></Field>
          <Field label="Reservoir level"><Select value={p.level_col} onChange={(e) => setP({ ...p, level_col: e.target.value })} options={d.numeric.map((c) => ({ value: c, label: c }))} /></Field>
          <Field label="Physics column (optional)" hint="If empty, an HST model is the physics baseline."><Select value={p.physics_col} onChange={(e) => setP({ ...p, physics_col: e.target.value })} placeholder="— HST baseline —" options={d.numeric.map((c) => ({ value: c, label: c }))} /></Field>
          <CheckList label="Residual-model inputs" options={d.numeric.filter((c) => c !== p.response_col)} value={p.residual_features} onChange={(v) => setP({ ...p, residual_features: v })} />
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="HST degree"><Input type="number" min={1} max={5} value={p.degree} onChange={(e) => setP({ ...p, degree: Number(e.target.value) })} /></Field>
            <Field label="Harmonics"><Input type="number" min={0} max={3} value={p.harmonics} onChange={(e) => setP({ ...p, harmonics: Number(e.target.value) })} /></Field>
            <Field label="Calibration fraction"><Input type="number" min={0.5} max={0.95} step={0.05} value={p.calibration_fraction} onChange={(e) => setP({ ...p, calibration_fraction: Number(e.target.value) })} /></Field>
            <Field label="GBR trees"><Input type="number" min={50} max={2000} value={p.n_estimators} onChange={(e) => setP({ ...p, n_estimators: Number(e.target.value) })} /></Field>
          </div>
          <p className="text-xs text-muted pt-1">Physics-informed neural networks (PINNs) require the PyTorch runtime and are not yet enabled on this server.</p>
        </>
      )} />
  );
}
