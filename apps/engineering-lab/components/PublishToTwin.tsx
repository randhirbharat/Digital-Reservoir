"use client";
import { useEffect, useState } from "react";
import { apiFetch, useSession } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { appUrls } from "@dr/shared-utilities";
import { ErrorBox, Field, Select } from "./ui";

/** Publish a completed HST run to a Digital Twin project sensor (requires Project Engineer/Administrator + MFA session). */
export function PublishToTwin({ runId, unit }: { runId: string; unit: string }) {
  const { user } = useSession();
  const projects = (user?.twin_projects ?? []).filter((p) => p.role === "project_admin" || p.role === "project_engineer");
  const [pid, setPid] = useState(""), [sensors, setSensors] = useState<any[] | null>(null), [target, setTarget] = useState(""), [level, setLevel] = useState("");
  const [thr, setThr] = useState("4"), [err, setErr] = useState<string | null>(null), [done, setDone] = useState<any>(null), [open, setOpen] = useState(false);
  useEffect(() => {
    if (!pid) return;
    setSensors(null); setErr(null);
    apiFetch<any[]>(`/twin/projects/${pid}/sensors`).then((s) => { setSensors(s); setTarget(s.find((x) => x.unit === unit)?.id ?? ""); setLevel(s.find((x) => x.variable === "reservoir_level")?.id ?? ""); }).catch((e) => setErr(e.detail));
  }, [pid, unit]);
  if (!projects.length) return null;
  if (!open) return <button className={buttonClass("secondary", "sm")} onClick={() => { setOpen(true); setPid(projects[0].project_id); }}>Publish to Digital Twin</button>;
  return (
    <div className="mt-3 rounded-[12px] border border-line bg-surface-2 p-4 space-y-1">
      <h3 className="font-semibold">Publish this HST model to a Digital Twin project</h3>
      <p className="text-xs text-muted">The Twin stores an immutable, versioned snapshot (formula, coefficients, calibration/validation periods, calibration-data provenance) and evaluates it on project data.</p>
      <Field label="Project"><Select value={pid} onChange={(e) => setPid(e.target.value)} options={projects.map((p) => ({ value: p.project_id, label: `${p.project_name} (${p.role.replace("_", " ")})` }))} /></Field>
      {sensors ? <>
        <Field label={`Response sensor (unit must be ${unit || "the same"})`}><Select value={target} onChange={(e) => setTarget(e.target.value)} placeholder="— select —" options={sensors.map((s) => ({ value: s.id, label: `${s.code} · ${s.variable} (${s.unit})` }))} /></Field>
        <Field label="Reservoir-level sensor"><Select value={level} onChange={(e) => setLevel(e.target.value)} placeholder="— select —" options={sensors.filter((s) => s.variable === "reservoir_level").map((s) => ({ value: s.id, label: s.code }))} /></Field>
        <Field label="Model-deviation alert: |standardised residual| >" hint="Screening threshold you choose; leave empty for no alerts. Not a validated engineering criterion."><input className="dr-field" type="number" step="0.1" min="0.1" value={thr} onChange={(e) => setThr(e.target.value)} /></Field>
      </> : null}
      <ErrorBox>{err}</ErrorBox>
      {done ? <p className="text-sm text-cond-normal">Published as HST v{done.version} on {done.sensor_code}. <a className="underline" href={`${appUrls().twin}/p/${pid}`} target="_blank" rel="noopener">Open in Digital Twin</a></p> : (
        <div className="flex gap-2 pt-2">
          <button className={buttonClass("primary", "sm")} disabled={!target || !level} onClick={async () => { setErr(null); try { setDone(await apiFetch(`/twin/projects/${pid}/models`, { json: { run_id: runId, sensor_id: target, level_sensor_id: level, deviation_threshold: thr ? Number(thr) : null } })); } catch (e: any) { setErr(e.detail); } }}>Publish</button>
          <button className={buttonClass("ghost", "sm")} onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
