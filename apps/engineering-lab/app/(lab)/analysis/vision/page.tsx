"use client";
import { useRef, useState, type FormEvent } from "react";
import { apiFetch, apiUpload } from "@dr/authentication";
import { buttonClass, EngineeringDisclaimer } from "@dr/design-system";
import { RunPanel } from "@/components/results";
import { ErrorBox, Field, Input, PageTitle, Panel, Spinner } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import type { Run } from "@/lib/types";

export default function VisionPage() {
  const file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ mm_per_pixel: "", sensitivity: "1", min_contrast: "0.08", component: "", location: "", captured_at: "" });
  const [run, setRun] = useState<Run | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const { data: history, reload } = useApi<Run[]>("/lab/analyses?kind=crack_detection");
  const [cmp, setCmp] = useState({ a: "", b: "" }), [cmpRes, setCmpRes] = useState<any>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    const img = file.current?.files?.[0]; if (!img) { setErr("Choose a PNG or JPEG image."); return; }
    const fd = new FormData(); fd.append("file", img); Object.entries(f).forEach(([k, v]) => v !== "" && fd.append(k, v));
    setBusy(true);
    try { setRun(await apiUpload<Run>("/api/v1/lab/vision/cracks", fd)); reload(); } catch (x: any) { setErr(x.detail); } finally { setBusy(false); }
  }
  return (
    <>
      <PageTitle title="Image-based damage detection" lead="Upload inspection images to find candidate cracks with a transparent classical algorithm (contrast normalisation, ridge filtering, shape and contrast tests). Every detection stays an unverified model output until an engineer reviews it." />
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel title="Inspection image">
            <form onSubmit={submit} className="space-y-1">
              <Field label="Image (PNG or JPEG, ≤ 15 MB)"><input ref={file} type="file" accept="image/png,image/jpeg" className="dr-field" /></Field>
              <Field label="Scale (mm per pixel, optional)" hint="From a scale bar or known target dimension."><Input type="number" step="any" value={f.mm_per_pixel} onChange={(e) => setF({ ...f, mm_per_pixel: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-x-3">
                <Field label="Sensitivity"><Input type="number" step="0.1" min="0.3" max="3" value={f.sensitivity} onChange={(e) => setF({ ...f, sensitivity: e.target.value })} /></Field>
                <Field label="Min contrast"><Input type="number" step="0.01" min="0" value={f.min_contrast} onChange={(e) => setF({ ...f, min_contrast: e.target.value })} /></Field>
              </div>
              <Field label="Structural component"><Input value={f.component} onChange={(e) => setF({ ...f, component: e.target.value })} /></Field>
              <Field label="Location"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="block, face, elevation" /></Field>
              <Field label="Captured on"><Input type="date" value={f.captured_at} onChange={(e) => setF({ ...f, captured_at: e.target.value })} /></Field>
              <ErrorBox>{err}</ErrorBox>
              <button className={buttonClass("primary", "md", "w-full mt-2")} disabled={busy}>{busy ? "Analysing…" : "Detect candidate cracks"}</button>
            </form>
          </Panel>
          <Panel title="Compare inspections (same view)">
            <Field label="Before"><select className="dr-field" value={cmp.a} onChange={(e) => setCmp({ ...cmp, a: e.target.value })}><option value="">—</option>{history?.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}</select></Field>
            <Field label="After"><select className="dr-field" value={cmp.b} onChange={(e) => setCmp({ ...cmp, b: e.target.value })}><option value="">—</option>{history?.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}</select></Field>
            <button className={buttonClass("secondary", "sm", "mt-2")} disabled={!cmp.a || !cmp.b} onClick={async () => setCmpRes(await apiFetch("/lab/vision/compare", { json: { before_run_id: cmp.a, after_run_id: cmp.b } }))}>Compare</button>
            {cmpRes ? <p className="text-sm mt-2">Total candidate length {cmpRes.total_length_px_before.toFixed(0)} → {cmpRes.total_length_px_after.toFixed(0)} px ({cmpRes.change_percent?.toFixed(1) ?? "—"} %). {cmpRes.note}</p> : null}
          </Panel>
        </div>
        <div className="space-y-4 min-w-0">{busy ? <Panel><Spinner label="Analysing image…" /></Panel> : run ? <RunPanel run={run} /> : <Panel><p className="text-sm text-muted">Results appear here. Previous detections are listed under Saved analyses.</p></Panel>}<EngineeringDisclaimer /></div>
      </div>
    </>
  );
}
