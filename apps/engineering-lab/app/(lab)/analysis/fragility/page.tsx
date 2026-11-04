"use client";
import { useState } from "react";
import { AnalysisLayout, useRunner } from "@/components/AnalysisLayout";
import { Field, Input, Select } from "@/components/ui";

export default function FragilityPage() {
  const runner = useRunner();
  const [p, setP] = useState({ method: "mle", im_col: "", outcome_col: "", record_col: "", capacity_col: "", edp_col: "", edp_threshold: "", damage_state: "DS2", im_label: "PGA (g)", n_boot: 300 });
  return (
    <AnalysisLayout title="Seismic fragility" runner={runner} submitLabel="Fit fragility function"
      lead="Lognormal fragility functions fitted to your dynamic-analysis results: maximum likelihood on multiple stripes (binary exceedance or EDP threshold) or method of moments on IDA capacities, with record-bootstrap confidence bands. No parameters are assumed — results reflect only the supplied analyses."
      onPicked={(d) => { const cols = d.columns.map((c) => c.name); setP((q) => ({ ...q, im_col: d.numeric.find((c) => /pga|sa|im/i.test(c)) || d.numeric[0] || "", outcome_col: d.numeric.find((c) => /exceed/i.test(c)) || "", record_col: cols.find((c) => /record|gm/i.test(c)) || "" })); }}
      canSubmit={(d) => !!d.versionId && (p.method === "ida" ? !!p.capacity_col : !!p.im_col && (!!p.outcome_col || (!!p.edp_col && p.edp_threshold !== "")))}
      onSubmit={(d) => runner.exec("fragility", { dataset_version_id: d.versionId, params: { ...p, edp_threshold: p.edp_threshold === "" ? null : Number(p.edp_threshold), outcome_col: p.edp_col ? null : p.outcome_col || null, record_col: p.record_col || null } })}
      form={(d) => {
        const num = d.numeric.map((c) => ({ value: c, label: c })), all = d.columns.map((c) => ({ value: c.name, label: c.name }));
        return (
          <>
            <Field label="Method"><Select value={p.method} onChange={(e) => setP({ ...p, method: e.target.value })} options={[{ value: "mle", label: "Maximum likelihood (multiple stripes)" }, { value: "ida", label: "IDA capacities (method of moments)" }]} /></Field>
            {p.method === "mle" ? <>
              <Field label="Intensity measure column"><Select value={p.im_col} onChange={(e) => setP({ ...p, im_col: e.target.value })} options={num} /></Field>
              <Field label="Exceedance outcome (0/1)"><Select value={p.outcome_col} onChange={(e) => setP({ ...p, outcome_col: e.target.value })} placeholder="— use EDP threshold —" options={num} /></Field>
              <div className="grid grid-cols-2 gap-x-3"><Field label="…or EDP column"><Select value={p.edp_col} onChange={(e) => setP({ ...p, edp_col: e.target.value })} placeholder="—" options={num} /></Field>
                <Field label="EDP threshold"><Input type="number" step="any" value={p.edp_threshold} onChange={(e) => setP({ ...p, edp_threshold: e.target.value })} /></Field></div>
              <Field label="Record identifier (for bootstrap)"><Select value={p.record_col} onChange={(e) => setP({ ...p, record_col: e.target.value })} placeholder="— rows —" options={all} /></Field>
            </> : <Field label="Capacity column (IM at damage state)"><Select value={p.capacity_col} onChange={(e) => setP({ ...p, capacity_col: e.target.value })} options={num} /></Field>}
            <div className="grid grid-cols-2 gap-x-3">
              <Field label="Damage state label"><Input value={p.damage_state} onChange={(e) => setP({ ...p, damage_state: e.target.value })} /></Field>
              <Field label="IM label"><Input value={p.im_label} onChange={(e) => setP({ ...p, im_label: e.target.value })} /></Field>
            </div>
            <Field label="Bootstrap samples"><Input type="number" min={0} max={2000} value={p.n_boot} onChange={(e) => setP({ ...p, n_boot: Number(e.target.value) })} /></Field>
          </>
        );
      }} />
  );
}
