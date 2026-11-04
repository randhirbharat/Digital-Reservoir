"use client";
import { useState } from "react";
import { buttonClass } from "@dr/design-system";
import { AnalysisLayout, useRunner } from "@/components/AnalysisLayout";
import { Field, Input, Select } from "@/components/ui";

type Op = Record<string, any> & { op: string };
const OP_DEFAULTS: Record<string, Op> = {
  baseline: { op: "baseline", mode: "first_n", n: 50 },
  detrend: { op: "detrend", type: "linear" },
  moving_average: { op: "moving_average", window: 7, center: true },
  butterworth: { op: "butterworth", btype: "lowpass", order: 4, cutoff: 0.1, low: 0.02, high: 0.2, unit: "cpd" },
};

export default function SignalPage() {
  const runner = useRunner();
  const [col, setCol] = useState(""), [axis, setAxis] = useState(""), [ops, setOps] = useState<Op[]>([OP_DEFAULTS.baseline, OP_DEFAULTS.butterworth]);
  const [fs, setFs] = useState(""), [wavelet, setWavelet] = useState(false), [stl, setStl] = useState("");
  const upd = (i: number, k: string, v: any) => setOps(ops.map((o, j) => (j === i ? { ...o, [k]: v } : o)));
  return (
    <AnalysisLayout title="Signal processing" runner={runner} submitLabel="Process and compare"
      lead="Compare the original, baseline-corrected, filtered and processed signals with the parameters of each step. Filters are zero-phase (forward–backward). Cut-offs can be entered in cycles per day or Hz and must lie below the Nyquist frequency of the record."
      onPicked={(d) => { setCol(d.numeric.find((c) => !/time/i.test(c)) || d.numeric[0] || ""); setAxis(d.dataset?.time_column ? `t:${d.dataset.time_column}` : d.numeric.find((c) => /time|^t$/i.test(c)) ? `x:${d.numeric.find((c) => /time|^t$/i.test(c))}` : ""); }}
      canSubmit={(d) => !!(d.versionId && col && (axis || fs))}
      onSubmit={(d) => {
        const toHz = (v: number, unit: string) => (unit === "cpd" ? v / 86400 : v);
        const operations = ops.map((o) => o.op !== "butterworth" ? o : { op: "butterworth", btype: o.btype, order: o.order, ...(o.btype === "bandpass" ? { low_hz: toHz(o.low, o.unit), high_hz: toHz(o.high, o.unit) } : { cutoff_hz: toHz(o.cutoff, o.unit) }), entered: { unit: o.unit === "cpd" ? "cycles/day" : "Hz", cutoff: o.cutoff, low: o.low, high: o.high } });
        runner.exec("signal", { dataset_version_id: d.versionId, params: { column: col, time_col: axis.startsWith("t:") ? axis.slice(2) : null, x_col: axis.startsWith("x:") ? axis.slice(2) : null, fs_hz: fs ? Number(fs) : null, operations, spectra: true, wavelet, stl_period: stl ? Number(stl) : null } });
      }}
      form={(d) => (
        <>
          <Field label="Signal column"><Select value={col} onChange={(e) => setCol(e.target.value)} options={d.numeric.map((c) => ({ value: c, label: c }))} /></Field>
          <Field label="Time axis" hint="A timestamp column, or a numeric column in seconds.">
            <Select value={axis} onChange={(e) => setAxis(e.target.value)} placeholder="— none (enter fs) —" options={[...d.timeCols.map((c) => ({ value: `t:${c}`, label: `${c} (timestamp)` })), ...d.numeric.map((c) => ({ value: `x:${c}`, label: `${c} (seconds)` }))]} />
          </Field>
          <Field label="Sampling frequency override (Hz)" hint="Leave empty to derive from the time axis (daily data ≈ 1.16e-5 Hz)."><Input type="number" step="any" value={fs} onChange={(e) => setFs(e.target.value)} /></Field>
          <div className="pt-2 font-semibold text-sm">Pipeline</div>
          <ol className="space-y-2">
            {ops.map((o, i) => (
              <li key={i} className="rounded-[10px] border border-line p-3 space-y-1">
                <div className="flex justify-between text-sm font-semibold">{i + 1}. {o.op.replace("_", " ")}<button type="button" aria-label="Remove step" className="text-cond-critical" onClick={() => setOps(ops.filter((_, j) => j !== i))}>×</button></div>
                {o.op === "baseline" ? <><Field label="Mode"><Select value={o.mode} onChange={(e) => upd(i, "mode", e.target.value)} options={[{ value: "first_n", label: "Mean of first N samples" }, { value: "mean", label: "Mean of whole record" }, { value: "value", label: "Fixed value" }]} /></Field>
                  {o.mode === "first_n" ? <Field label="N"><Input type="number" value={o.n} onChange={(e) => upd(i, "n", Number(e.target.value))} /></Field> : null}
                  {o.mode === "value" ? <Field label="Value"><Input type="number" step="any" value={o.value ?? 0} onChange={(e) => upd(i, "value", Number(e.target.value))} /></Field> : null}</> : null}
                {o.op === "detrend" ? <Field label="Type"><Select value={o.type} onChange={(e) => upd(i, "type", e.target.value)} options={[{ value: "linear", label: "Linear" }, { value: "constant", label: "Constant (mean removal)" }]} /></Field> : null}
                {o.op === "moving_average" ? <Field label="Window (samples)"><Input type="number" min={1} value={o.window} onChange={(e) => upd(i, "window", Number(e.target.value))} /></Field> : null}
                {o.op === "butterworth" ? <>
                  <Field label="Type"><Select value={o.btype} onChange={(e) => upd(i, "btype", e.target.value)} options={[{ value: "lowpass", label: "Low-pass" }, { value: "highpass", label: "High-pass" }, { value: "bandpass", label: "Band-pass" }]} /></Field>
                  <Field label="Frequency unit" hint="Cycles per day suits slow monitoring data (daily or hourly); Hz suits vibration records."><Select value={o.unit} onChange={(e) => upd(i, "unit", e.target.value)} options={[{ value: "cpd", label: "cycles per day" }, { value: "hz", label: "Hz" }]} /></Field>
                  {o.btype === "bandpass" ? <div className="grid grid-cols-2 gap-x-2"><Field label="Low"><Input type="number" step="any" value={o.low} onChange={(e) => upd(i, "low", Number(e.target.value))} /></Field><Field label="High"><Input type="number" step="any" value={o.high} onChange={(e) => upd(i, "high", Number(e.target.value))} /></Field></div>
                    : <Field label="Cut-off" hint={o.unit === "cpd" && o.cutoff > 0 ? `Period ≈ ${(1 / o.cutoff).toFixed(1)} days` : undefined}><Input type="number" step="any" value={o.cutoff} onChange={(e) => upd(i, "cutoff", Number(e.target.value))} /></Field>}
                  <Field label="Order"><Input type="number" min={1} max={10} value={o.order} onChange={(e) => upd(i, "order", Number(e.target.value))} /></Field></> : null}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">{Object.keys(OP_DEFAULTS).map((k) => <button type="button" key={k} className={buttonClass("secondary", "sm")} onClick={() => setOps([...ops, { ...OP_DEFAULTS[k] }])}>+ {k.replace("_", " ")}</button>)}</div>
          <label className="flex items-center gap-2 text-sm min-h-[32px] pt-2"><input type="checkbox" className="size-4" checked={wavelet} onChange={(e) => setWavelet(e.target.checked)} />Wavelet scalogram (Morlet CWT)</label>
          <Field label="Seasonal decomposition period (samples, optional)" hint="e.g. 365 for daily data with an annual cycle (STL)."><Input type="number" value={stl} onChange={(e) => setStl(e.target.value)} /></Field>
        </>
      )} />
  );
}
