"use client";
import { useState } from "react";
import { AnalysisLayout, useRunner } from "@/components/AnalysisLayout";
import { Field, Input, Select } from "@/components/ui";

export default function HstPage() {
  const runner = useRunner();
  const [p, setP] = useState({ time_col: "", response_col: "", level_col: "", temperature_col: "", degree: 4, harmonics: 2, time_terms: ["linear", "log"], calibration_fraction: 0.8, calibration_end: "", alpha: 0.05, residual_threshold: 2.5, unit: "" });
  return (
    <AnalysisLayout title="HST analysis" runner={runner} submitLabel="Fit HST model"
      lead="Hydrostatic–Season–Time regression with chronological calibration/validation, component separation and prediction intervals. The exact formulation and assumptions are reported with every result."
      canSubmit={(d) => !!(d.versionId && p.time_col && p.response_col && p.level_col)}
      onSubmit={(d) => runner.exec("hst", { dataset_version_id: d.versionId, params: { ...p, temperature_col: p.temperature_col || null, calibration_end: p.calibration_end || null, unit: p.unit || d.dataset?.units[p.response_col] || "" } })}
      onPicked={(d) => {
        const n = d.numeric;
        setP((q) => ({ ...q, time_col: d.dataset?.time_column || d.timeCols[0] || "", response_col: n.find((c) => /disp|pl|pend|response/i.test(c)) || n[0] || "", level_col: n.find((c) => /level|reservoir|head|wl/i.test(c)) || n[1] || "" }));
      }}
      form={(d) => {
        const opt = (xs: string[]) => xs.map((c) => ({ value: c, label: c }));
        return (
          <>
            <Field label="Time column"><Select value={p.time_col} onChange={(e) => setP({ ...p, time_col: e.target.value })} options={opt(d.timeCols)} placeholder="—" /></Field>
            <Field label="Response variable"><Select value={p.response_col} onChange={(e) => setP({ ...p, response_col: e.target.value })} options={opt(d.numeric)} /></Field>
            <Field label="Reservoir level (hydrostatic variable)"><Select value={p.level_col} onChange={(e) => setP({ ...p, level_col: e.target.value })} options={opt(d.numeric)} /></Field>
            <Field label="Temperature (optional → HTT variant)" hint="If selected, measured temperature replaces the seasonal harmonics."><Select value={p.temperature_col} onChange={(e) => setP({ ...p, temperature_col: e.target.value })} options={opt(d.numeric)} placeholder="— seasonal harmonics —" /></Field>
            <div className="grid grid-cols-2 gap-x-3">
              <Field label="Hydrostatic degree"><Select value={String(p.degree)} onChange={(e) => setP({ ...p, degree: Number(e.target.value) })} options={[1, 2, 3, 4, 5].map((v) => ({ value: String(v), label: `h^${v}` }))} /></Field>
              <Field label="Seasonal harmonics"><Select value={String(p.harmonics)} onChange={(e) => setP({ ...p, harmonics: Number(e.target.value) })} options={[0, 1, 2, 3].map((v) => ({ value: String(v), label: String(v) }))} /></Field>
            </div>
            <fieldset><legend className="dr-label">Time terms</legend>
              {[["linear", "c·t"], ["exp", "c·e^(−t)"], ["log", "c·ln(1+t)"]].map(([k, l]) => (
                <label key={k} className="mr-4 inline-flex items-center gap-2 text-sm min-h-[32px]"><input type="checkbox" className="size-4" checked={p.time_terms.includes(k)} onChange={(e) => setP({ ...p, time_terms: e.target.checked ? [...p.time_terms, k] : p.time_terms.filter((x) => x !== k) })} /><span className="font-mono">{l}</span></label>
              ))}
            </fieldset>
            <Field label="Calibration fraction (chronological)" hint="The earliest part is used for fitting; the rest is validation."><Input type="number" min={0.3} max={1} step={0.05} value={p.calibration_fraction} onChange={(e) => setP({ ...p, calibration_fraction: Number(e.target.value) })} /></Field>
            <Field label="…or calibration end date (overrides fraction)"><Input type="date" value={p.calibration_end} onChange={(e) => setP({ ...p, calibration_end: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-x-3">
              <Field label="Interval α"><Input type="number" min={0.01} max={0.32} step={0.01} value={p.alpha} onChange={(e) => setP({ ...p, alpha: Number(e.target.value) })} /></Field>
              <Field label="Residual screening |z|"><Input type="number" min={1} step={0.1} value={p.residual_threshold} onChange={(e) => setP({ ...p, residual_threshold: Number(e.target.value) })} /></Field>
            </div>
            <p className="text-xs text-muted pt-1">The screening threshold is a user assumption for flagging, not a validated engineering criterion.</p>
          </>
        );
      }} />
  );
}
