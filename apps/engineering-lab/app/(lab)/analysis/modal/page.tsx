"use client";
import { useState } from "react";
import { AnalysisLayout, useRunner } from "@/components/AnalysisLayout";
import { CheckList, Field, Input, Select } from "@/components/ui";

export default function ModalPage() {
  const runner = useRunner();
  const [ch, setCh] = useState<string[]>([]), [tcol, setTcol] = useState(""), [fs, setFs] = useState(""), [fmax, setFmax] = useState("20"), [n, setN] = useState(4);
  return (
    <AnalysisLayout title="Operational modal analysis" runner={runner} submitLabel="Identify modes"
      lead="Output-only identification from ambient vibration: frequency-domain decomposition of the cross-spectral matrix, peak picking, half-power damping and MAC between identified modes. Track identified frequencies over time (after environmental normalisation) as health indicators."
      onPicked={(d) => { setCh(d.numeric.filter((c) => /acc/i.test(c)).slice(0, 6)); setTcol(d.numeric.find((c) => /time|^t$/i.test(c)) || ""); }}
      canSubmit={(d) => !!(d.versionId && ch.length && (tcol || fs))}
      onSubmit={(d) => runner.exec("modal", { dataset_version_id: d.versionId, params: { channels: ch, time_col: tcol || null, fs_hz: fs ? Number(fs) : null, f_max: fmax ? Number(fmax) : null, n_modes: n } })}
      form={(d) => (
        <>
          <CheckList label="Acceleration channels" options={d.numeric.filter((c) => c !== tcol)} value={ch} onChange={setCh} />
          <Field label="Time column (seconds)"><Select value={tcol} onChange={(e) => setTcol(e.target.value)} placeholder="— none —" options={d.numeric.map((c) => ({ value: c, label: c }))} /></Field>
          <Field label="…or sampling frequency (Hz)"><Input type="number" step="any" value={fs} onChange={(e) => setFs(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Max frequency (Hz)"><Input type="number" step="any" value={fmax} onChange={(e) => setFmax(e.target.value)} /></Field>
            <Field label="Modes to report"><Input type="number" min={1} max={10} value={n} onChange={(e) => setN(Number(e.target.value))} /></Field>
          </div>
        </>
      )} />
  );
}
