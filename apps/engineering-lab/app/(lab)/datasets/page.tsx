"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { apiFetch, apiUpload, useSession } from "@dr/authentication";
import { ProvenanceBadge, buttonClass } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import { ErrorBox, Field, Input, PageTitle, Panel, Select, Spinner } from "@/components/ui";
import { errMsg, useApi } from "@/lib/useApi";
import type { DatasetFull } from "@/lib/types";

const SAMPLES = [
  ["gravity_dam_daily", "Gravity dam — daily (3 years)", "Displacement, level, temperature, piezometer, seepage; contains deliberate data-quality issues."],
  ["ambient_vibration", "Ambient vibration — 100 Hz", "Two channels, modes at 3.2 and 7.9 Hz."],
  ["fragility_stripes", "Fragility — multiple stripes", "Exceedance outcomes at 11 intensity levels."],
];

export default function Datasets() {
  const { data, loading, reload } = useApi<DatasetFull[]>("/lab/datasets");
  const { data: projects } = useApi<any[]>("/lab/projects");
  const { user } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", provenance: "historical", project_id: "", description: "" });
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  async function upload(e: FormEvent) {
    e.preventDefault(); setErr(null);
    const f = fileRef.current?.files?.[0];
    if (!f) { setErr("Choose a CSV or Excel file."); return; }
    const fd = new FormData();
    fd.append("file", f); Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    setBusy(true);
    try { await apiUpload("/api/v1/lab/datasets", fd); if (fileRef.current) fileRef.current.value = ""; reload(); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  }
  async function sample(id: string) {
    setBusy(true); setErr(null);
    try { await apiFetch(`/lab/datasets/samples/${id}`, { method: "POST" }); reload(); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  }
  return (
    <>
      <PageTitle title="Datasets & processing" lead="Uploads are validated and stored unchanged as version 1. Every processing step creates a new version with its parameters and history." />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Panel title="Your datasets">
          {loading ? <Spinner /> : data?.length ? (
            <div className="dr-table-wrap"><table className="dr-table"><thead><tr><th>Name</th><th>Provenance</th><th>Versions</th><th>Rows (latest)</th><th>Uploaded</th></tr></thead><tbody>
              {data.map((d) => { const v = d.versions[d.versions.length - 1]; return (
                <tr key={d.id}><td><Link href={`/datasets/${d.id}`} className="font-semibold text-accent-ink">{d.name}</Link><div className="text-xs text-muted font-mono">{d.filename}</div></td>
                  <td><ProvenanceBadge kind={d.provenance === "historical" ? "historical" : d.provenance} /></td><td>{d.versions.length}</td><td className="font-mono">{v.rows.toLocaleString()}</td><td>{formatTimestamp(d.created_at)}</td></tr>); })}
            </tbody></table></div>
          ) : <p className="text-sm text-muted">No datasets yet. Upload a file or import a synthetic sample.</p>}
        </Panel>
        <div className="space-y-5">
          <Panel title="Upload CSV or Excel">
            <form onSubmit={upload} className="space-y-1">
              <Field label="File (.csv, .txt, .xlsx)" hint={`Limit for your category (${user?.membership_category}). Lines beginning with # are treated as header comments.`}><input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" className="dr-field" /></Field>
              <Field label="Display name (optional)"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Data provenance" hint="Required. Determines how results are labelled everywhere.">
                <Select value={form.provenance} onChange={(e) => setForm({ ...form, provenance: e.target.value })} options={[{ value: "historical", label: "Historical measured data" }, { value: "imported", label: "Imported third-party data" }, { value: "synthetic", label: "Synthetic / example data" }]} />
              </Field>
              <Field label="Project"><Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} placeholder="— none —" options={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))} /></Field>
              <p className="text-xs text-muted pt-1">Do not upload confidential project data unless you are authorised to do so.</p>
              <ErrorBox>{err}</ErrorBox>
              <button className={buttonClass("primary", "md", "w-full mt-2")} disabled={busy}>{busy ? "Uploading…" : "Upload and validate"}</button>
            </form>
          </Panel>
          <Panel title="Synthetic sample datasets">
            <ul className="space-y-3">{SAMPLES.map(([id, t, d]) => (
              <li key={id} className="flex items-start justify-between gap-3"><div><div className="font-semibold text-sm">{t}</div><div className="text-xs text-muted">{d}</div></div><button className={buttonClass("secondary", "sm")} onClick={() => sample(id)} disabled={busy}>Import</button></li>
            ))}</ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
