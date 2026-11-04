"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiDownload, apiFetch } from "@dr/authentication";
import { ProvenanceBadge, buttonClass } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import { QualityResult } from "@/components/results";
import { DataTable, ErrorBox, Field, Input, KV, PageTitle, Panel, Select, Spinner } from "@/components/ui";
import { errMsg, useApi } from "@/lib/useApi";
import type { DatasetFull } from "@/lib/types";

type Op = { operation: string; params: Record<string, any> };
const OPS: { id: string; label: string; fields: { key: string; label: string; type: "column" | "time" | "text" | "number"; def?: any }[] }[] = [
  { id: "drop_duplicates", label: "Remove exact duplicate rows", fields: [] },
  { id: "sort_time", label: "Parse timestamps (UTC) and sort", fields: [{ key: "time_col", label: "Time column", type: "time" }] },
  { id: "flag_outliers_to_missing", label: "Set outliers to missing (Hampel)", fields: [{ key: "column", label: "Column", type: "column" }, { key: "mad_threshold", label: "Robust z threshold", type: "number", def: 5 }, { key: "window", label: "Window (samples)", type: "number", def: 11 }] },
  { id: "interpolate", label: "Interpolate short gaps (linear)", fields: [{ key: "column", label: "Column", type: "column" }, { key: "limit", label: "Max gap (samples)", type: "number", def: 3 }] },
  { id: "resample", label: "Resample / synchronise to regular grid", fields: [{ key: "time_col", label: "Time column", type: "time" }, { key: "rule", label: "Interval (e.g. 1h, 1D, 7D)", type: "text", def: "1D" }, { key: "agg", label: "Aggregation (mean/median/min/max/last)", type: "text", def: "mean" }] },
  { id: "unit_convert", label: "Unit conversion (value × factor + offset)", fields: [{ key: "column", label: "Column", type: "column" }, { key: "factor", label: "Factor", type: "number", def: 1 }, { key: "offset", label: "Offset", type: "number", def: 0 }, { key: "from_unit", label: "From unit", type: "text", def: "" }, { key: "to_unit", label: "To unit", type: "text", def: "" }, { key: "new_name", label: "New column name (optional)", type: "text", def: "" }] },
  { id: "select_columns", label: "Keep selected columns", fields: [{ key: "columns", label: "Columns (comma-separated)", type: "text", def: "" }] },
];

export default function DatasetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: ds, reload } = useApi<DatasetFull>(`/lab/datasets/${id}`);
  const { data: projects } = useApi<any[]>("/lab/projects");
  const [vid, setVid] = useState("");
  const version = ds?.versions.find((v) => v.id === vid) ?? ds?.versions[ds.versions.length - 1];
  const { data: preview } = useApi<{ columns: string[]; rows: any[][] }>(version ? `/lab/versions/${version.id}/preview?rows=25` : null);
  const [quality, setQuality] = useState<any>(null), [qBusy, setQBusy] = useState(false);
  const [ops, setOps] = useState<Op[]>([]), [newOp, setNewOp] = useState("drop_duplicates"), [label, setLabel] = useState("Processed"), [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { setQuality(null); }, [version?.id]);
  if (!ds) return <Spinner />;
  const cols = (version?.columns ?? []) as any[];
  const numeric = cols.filter((c) => c.kind === "numeric").map((c) => c.name);
  const timeCols = cols.filter((c) => c.kind === "datetime").map((c) => c.name);

  async function runQuality() {
    setQBusy(true); setErr(null);
    try { const r = await apiFetch<any>("/lab/analyses/quality", { json: { dataset_version_id: version!.id, params: { time_col: ds!.time_column } } }); setQuality(r.result); }
    catch (x) { setErr(errMsg(x)); } finally { setQBusy(false); }
  }
  function addOp() {
    const spec = OPS.find((o) => o.id === newOp)!;
    const params: Record<string, any> = {};
    spec.fields.forEach((f) => { params[f.key] = f.def ?? (f.type === "time" ? ds!.time_column ?? timeCols[0] ?? "" : f.type === "column" ? numeric[0] ?? "" : ""); });
    setOps([...ops, { operation: newOp, params }]);
  }
  async function process() {
    setBusy(true); setErr(null);
    const clean = ops.map((o) => ({ ...o, params: Object.fromEntries(Object.entries(o.params).filter(([, v]) => v !== "").map(([k, v]) => [k, k === "columns" && typeof v === "string" ? v.split(",").map((s: string) => s.trim()).filter(Boolean) : v])) }));
    try { const nv = await apiFetch<any>(`/lab/versions/${version!.id}/process`, { json: { operations: clean, label } }); setOps([]); await reload(); setVid(nv.id); }
    catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  }
  return (
    <>
      <PageTitle title={ds.name} lead={ds.description || undefined}
        actions={<>
          <button className={buttonClass("secondary", "sm")} onClick={() => apiDownload(`/lab/versions/${version!.id}/download`, `${ds.filename.replace(/\.\w+$/, "")}_v${version!.version}.${version!.validation?.format === "xlsx (first sheet)" ? "xlsx" : "csv"}`)}>Download v{version?.version}</button>
          <button className={buttonClass("danger", "sm")} onClick={async () => { if (confirm("Delete this dataset and all its versions?")) { await apiFetch(`/lab/datasets/${id}`, { method: "DELETE" }); router.push("/datasets"); } }}>Delete</button>
        </>} />
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="space-y-5 min-w-0">
          <Panel title="Dataset">
            <div className="mb-3"><ProvenanceBadge kind={ds.provenance === "historical" ? "historical" : ds.provenance} /></div>
            <KV items={[["File", ds.filename], ["Time column", ds.time_column ?? "none detected"], ["Uploaded", formatTimestamp(ds.created_at)], ["Rows (selected)", version?.rows.toLocaleString()], ["SHA-256", `${version?.sha256.slice(0, 16)}…`]]} />
            <Field label="Project"><Select value={ds.project_id ?? ""} placeholder="— none —" options={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
              onChange={async (e) => { await apiFetch(`/lab/datasets/${id}`, { method: "PATCH", json: { project_id: e.target.value } }); reload(); }} /></Field>
            <Field label="Time column"><Select value={ds.time_column ?? ""} placeholder="— none —" options={timeCols.map((c) => ({ value: c, label: c }))}
              onChange={async (e) => { await apiFetch(`/lab/datasets/${id}`, { method: "PATCH", json: { time_column: e.target.value } }); reload(); }} /></Field>
          </Panel>
          <Panel title="Versions">
            <ol className="space-y-2">
              {ds.versions.map((v) => (
                <li key={v.id}>
                  <button className={`w-full text-left rounded-[9px] border px-3 py-2 ${v.id === version?.id ? "border-accent bg-sage/60" : "border-line"}`} onClick={() => setVid(v.id)} aria-current={v.id === version?.id}>
                    <div className="font-semibold text-sm">v{v.version} · {v.label} {v.is_original ? "(original)" : ""}</div>
                    <div className="text-xs text-muted">{v.rows.toLocaleString()} rows · {formatTimestamp(v.created_at)}{v.is_original ? " · read-only original" : ""}</div>
                  </button>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Columns & units">
            <ul className="space-y-1 text-sm">{cols.map((c) => <li key={c.name} className="flex justify-between gap-2"><span className="font-mono truncate">{c.name}</span><span className="text-muted text-xs">{c.kind}{ds.units[c.name] ? ` · ${ds.units[c.name]}` : ""}{c.missing ? ` · ${c.missing} missing` : ""}</span></li>)}</ul>
            <UnitEditor columns={numeric} units={ds.units} onSave={async (u) => { await apiFetch(`/lab/datasets/${id}`, { method: "PATCH", json: { units: u } }); reload(); }} />
          </Panel>
        </div>
        <div className="space-y-5 min-w-0">
          <Panel title={`Preview · v${version?.version} (first 25 rows)`}>
            {preview ? <DataTable rows={preview.rows.map((r) => Object.fromEntries(preview.columns.map((c, i) => [c, r[i]])))} columns={preview.columns} /> : <Spinner />}
          </Panel>
          <Panel title="Data-quality assessment" actions={<button className={buttonClass("primary", "sm")} onClick={runQuality} disabled={qBusy}>{qBusy ? "Assessing…" : `Assess v${version?.version}`}</button>}>
            {quality ? <QualityResult r={quality} /> : <p className="text-sm text-muted">Checks missing values, duplicates, timestamp problems, sampling gaps and outliers (local Hampel filter for time series). Nothing is modified.</p>}
          </Panel>
        </div>
        <div className="space-y-5 min-w-0">
          <Panel title="Processing pipeline">
            <p className="text-xs text-muted mb-2">Applied to v{version?.version}; the result is saved as a new version.</p>
            <ol className="space-y-3">
              {ops.map((o, i) => { const spec = OPS.find((s) => s.id === o.operation)!; return (
                <li key={i} className="rounded-[10px] border border-line p-3">
                  <div className="flex justify-between gap-2 text-sm font-semibold">{i + 1}. {spec.label}<button aria-label="Remove step" className="text-cond-critical" onClick={() => setOps(ops.filter((_, j) => j !== i))}>×</button></div>
                  {spec.fields.map((f) => (
                    <Field key={f.key} label={f.label}>
                      {f.type === "column" || f.type === "time" ? (
                        <Select value={o.params[f.key]} options={(f.type === "time" ? timeCols : numeric).map((c) => ({ value: c, label: c }))} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, params: { ...x.params, [f.key]: e.target.value } } : x))} />
                      ) : (
                        <Input type={f.type === "number" ? "number" : "text"} step="any" value={o.params[f.key]} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, params: { ...x.params, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value } } : x))} />
                      )}
                    </Field>
                  ))}
                </li>); })}
            </ol>
            <div className="flex gap-2 mt-3"><Select value={newOp} onChange={(e) => setNewOp(e.target.value)} options={OPS.map((o) => ({ value: o.id, label: o.label }))} /><button className={buttonClass("secondary", "md")} onClick={addOp}>Add</button></div>
            <Field label="New version label"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
            <ErrorBox>{err}</ErrorBox>
            <button className={buttonClass("primary", "md", "w-full mt-3")} disabled={!ops.length || busy} onClick={process}>{busy ? "Processing…" : "Save as new version"}</button>
          </Panel>
          <Panel title="Processing history">
            <ol className="list-decimal pl-5 space-y-1.5 text-sm">{version?.processing.map((p: any, i: number) => <li key={i}>{p.summary}<span className="block text-xs text-muted">{p.at ? formatTimestamp(p.at) : ""}</span></li>)}</ol>
          </Panel>
        </div>
      </div>
    </>
  );
}

function UnitEditor({ columns, units, onSave }: { columns: string[]; units: Record<string, string>; onSave: (u: Record<string, string>) => void }) {
  const [u, setU] = useState(units); const [open, setOpen] = useState(false);
  useEffect(() => setU(units), [units]);
  if (!open) return <button className="mt-2 text-sm underline text-accent-ink" onClick={() => setOpen(true)}>Edit units</button>;
  return (
    <div className="mt-2 space-y-1">
      {columns.map((c) => <Field key={c} label={c}><Input value={u[c] ?? ""} placeholder="e.g. mm" onChange={(e) => setU({ ...u, [c]: e.target.value })} /></Field>)}
      <button className={buttonClass("primary", "sm", "mt-2")} onClick={() => { onSave(u); setOpen(false); }}>Save units</button>
    </div>
  );
}
