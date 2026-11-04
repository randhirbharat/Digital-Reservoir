"use client";
import { useState } from "react";
import { buttonClass } from "@dr/design-system";
import { AnalysisLayout, useRunner } from "@/components/AnalysisLayout";
import { Field, Input, Select } from "@/components/ui";

type Ind = { name: string; column: string; value: string; ref_good: string; ref_poor: string; justification: string };

export default function DhiPage() {
  const runner = useRunner();
  const [inds, setInds] = useState<Ind[]>([]);
  const [mode, setMode] = useState<"manual" | "ahp">("manual"), [weights, setWeights] = useState<string[]>([]), [ahp, setAhp] = useState<string[][]>([]);
  const [agg, setAgg] = useState("arithmetic"), [justification, setJustification] = useState(""), [classes, setClasses] = useState("");
  const add = (col = "") => { setInds([...inds, { name: col || `Indicator ${inds.length + 1}`, column: col, value: "", ref_good: "", ref_poor: "", justification: "" }]); setWeights([...weights, "1"]); setAhp((m) => { const n = m.length + 1; return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? "1" : m[i]?.[j] ?? "1"))); }); };
  const upd = (i: number, k: keyof Ind, v: string) => setInds(inds.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const setPair = (i: number, j: number, v: string) => setAhp(ahp.map((row, a) => row.map((c, b) => (a === i && b === j ? v : a === j && b === i ? String(+(1 / Number(v || 1)).toFixed(4)) : c))));
  return (
    <AnalysisLayout title="Dam Health Index" runner={runner} submitLabel="Compute index"
      lead="Configure indicators, project-specific reference values, weights (direct or AHP pairwise comparison) and aggregation. No default weights or condition classes are applied — you must provide and justify them. Sensitivity to every weight is reported."
      canSubmit={(d) => inds.length > 0 && inds.every((i) => i.ref_good !== "" && i.ref_poor !== "" && (i.value !== "" || (i.column && d.versionId)))}
      onSubmit={(d) => runner.exec("dhi", {
        dataset_version_id: inds.some((i) => i.column) ? d.versionId : null,
        params: {
          indicators: inds.map((i) => ({ name: i.name, column: i.column || undefined, value: i.value === "" ? undefined : Number(i.value), ref_good: Number(i.ref_good), ref_poor: Number(i.ref_poor), justification: i.justification })),
          weights: mode === "manual" ? weights.map(Number) : undefined, ahp_matrix: mode === "ahp" ? ahp.map((r) => r.map(Number)) : undefined, aggregation: agg,
          weight_justification: justification, time_col: d.dataset?.time_column || null,
          classes: classes.trim() ? classes.split(";").map((s) => { const [label, min] = s.split("="); return { label: label.trim(), min: Number(min) }; }) : undefined,
        },
      })}
      form={(d) => (
        <>
          <p className="text-xs text-muted">Indicator values come from the latest value of a dataset column (and give an index history), or are entered directly.</p>
          {inds.map((ind, i) => (
            <fieldset key={i} className="rounded-[10px] border border-line p-3 space-y-1">
              <legend className="px-1 text-sm font-semibold">Indicator {i + 1}</legend>
              <Field label="Name"><Input value={ind.name} onChange={(e) => upd(i, "name", e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-x-2">
                <Field label="Column"><Select value={ind.column} onChange={(e) => upd(i, "column", e.target.value)} placeholder="— value —" options={d.numeric.map((c) => ({ value: c, label: c }))} /></Field>
                <Field label="…or value"><Input type="number" step="any" value={ind.value} onChange={(e) => upd(i, "value", e.target.value)} disabled={!!ind.column} /></Field>
                <Field label="Reference: good (→1)"><Input type="number" step="any" value={ind.ref_good} onChange={(e) => upd(i, "ref_good", e.target.value)} /></Field>
                <Field label="Reference: poor (→0)"><Input type="number" step="any" value={ind.ref_poor} onChange={(e) => upd(i, "ref_poor", e.target.value)} /></Field>
              </div>
              <Field label="Justification / source of references"><Input value={ind.justification} onChange={(e) => upd(i, "justification", e.target.value)} /></Field>
              {mode === "manual" ? <Field label="Weight"><Input type="number" min={0} step="any" value={weights[i]} onChange={(e) => setWeights(weights.map((w, j) => (j === i ? e.target.value : w)))} /></Field> : null}
              <button type="button" className="text-sm text-cond-critical" onClick={() => { setInds(inds.filter((_, j) => j !== i)); setWeights(weights.filter((_, j) => j !== i)); setAhp(ahp.filter((_, a) => a !== i).map((r) => r.filter((_, b) => b !== i))); }}>Remove</button>
            </fieldset>
          ))}
          <button type="button" className={buttonClass("secondary", "sm", "w-full")} onClick={() => add()}>+ Add indicator</button>
          <Field label="Weighting"><Select value={mode} onChange={(e) => setMode(e.target.value as "manual" | "ahp")} options={[{ value: "manual", label: "Direct weights (normalised)" }, { value: "ahp", label: "AHP pairwise comparison" }]} /></Field>
          {mode === "ahp" && inds.length > 1 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted">How much more important is the row indicator than the column indicator (1–9 or reciprocal)?</p>
              {inds.map((a, i) => inds.map((b, j) => (j > i ? (
                <Field key={`${i}-${j}`} label={`${a.name} vs ${b.name}`}><Input type="number" min={0.111} max={9} step="any" value={ahp[i]?.[j] ?? "1"} onChange={(e) => setPair(i, j, e.target.value)} /></Field>
              ) : null)))}
            </div>
          ) : null}
          <Field label="Aggregation"><Select value={agg} onChange={(e) => setAgg(e.target.value)} options={[{ value: "arithmetic", label: "Weighted arithmetic (compensatory)" }, { value: "geometric", label: "Weighted geometric (partly compensatory)" }, { value: "minimum", label: "Minimum (non-compensatory)" }]} /></Field>
          <Field label="Weight justification" hint="Required for a documented index."><textarea className="dr-field" rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} /></Field>
          <Field label="Condition classes (optional, project-specific)" hint="Format: Label=min; e.g. Good=0.8; Fair=0.6; Poor=0"><Input value={classes} onChange={(e) => setClasses(e.target.value)} /></Field>
        </>
      )} />
  );
}
