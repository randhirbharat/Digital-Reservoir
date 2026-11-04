"use client";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import { Prov } from "@/components/Badges";
import { ErrorBox, Field, Panel } from "@/components/ui";
import { COND_COLOR, useProject } from "@/lib/twin";

export default function Alerts() {
  const { project, alerts, sensors, can, refresh } = useProject();
  const [filter, setFilter] = useState<"open" | "acknowledged" | "closed" | "all">("open");
  const [notes, setNotes] = useState<Record<string, string>>({}), [err, setErr] = useState<string | null>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [rf, setRf] = useState({ sensor_id: "", level: "attention", comparator: "gt", threshold: "", criteria_reference: "" });
  const loadRules = () => apiFetch<any[]>(`/twin/projects/${project.id}/rules`).then(setRules);
  useEffect(() => { void loadRules(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const code = (id: string | null) => sensors.find((s) => s.id === id)?.code ?? "—";
  const shown = alerts.filter((a) => filter === "all" || a.status === filter);
  const act = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); await refresh(); } catch (x: any) { setErr(x.detail); } };
  async function addRule(e: FormEvent) { e.preventDefault(); await act(async () => { await apiFetch(`/twin/projects/${project.id}/rules`, { json: { ...rf, threshold: Number(rf.threshold) } }); setRf({ ...rf, threshold: "", criteria_reference: "" }); loadRules(); }); }
  return (
    <div className="space-y-4">
      <h1 className="font-display font-extrabold text-xl text-ivory">Alerts & condition criteria</h1>
      <p className="text-sm text-muted max-w-[90ch]">Automated alerts are prompts for engineering review. They are not formal safety determinations. Closing an alert requires a note describing the review.</p>
      <ErrorBox>{err}</ErrorBox>
      <Panel title="Alert history" actions={<div role="group" aria-label="Filter alerts" className="flex gap-1">{(["open", "acknowledged", "closed", "all"] as const).map((f) => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-[8px] border px-3 min-h-[34px] text-xs capitalize ${filter === f ? "border-aqua text-ivory" : "border-line text-muted"}`}>{f}</button>)}</div>}>
        <ul className="space-y-2">
          {shown.map((a) => (
            <li key={a.id} className="rounded-[10px] border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold" style={{ color: COND_COLOR[a.severity] ?? "#E6EEEB" }}>{a.kind.replace("_", " ")} · {a.severity} · {code(a.sensor_id)}</span><span className="flex items-center gap-2 text-xs text-muted"><Prov kind={a.source} />{a.status} · {formatTimestamp(a.created_at)}</span></div>
              <p className="mt-1 text-sm text-muted">{a.message}</p>
              {a.status !== "open" ? <p className="mt-1 text-xs text-muted">{a.acknowledged_at ? `Acknowledged ${formatTimestamp(a.acknowledged_at)}. ` : ""}{a.closed_at ? `Closed ${formatTimestamp(a.closed_at)}: ${a.closure_note}` : ""}</p> : null}
              {can("alert_ack") && a.status !== "closed" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {a.status === "open" ? <button className={buttonClass("secondary", "sm")} onClick={() => act(() => apiFetch(`/twin/projects/${project.id}/alerts/${a.id}/acknowledge`, { method: "POST" }))}>Acknowledge</button> : null}
                  <input className="dr-field !min-h-[36px] flex-1 min-w-[200px]" placeholder="Review note (required to close)" aria-label="Closure note" value={notes[a.id] ?? ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} />
                  <button className={buttonClass("secondary", "sm")} onClick={() => act(() => apiFetch(`/twin/projects/${project.id}/alerts/${a.id}/close`, { json: { note: notes[a.id] ?? "" } }))}>Close</button>
                </div>
              ) : null}
            </li>
          ))}
          {!shown.length ? <li className="text-sm text-muted">No {filter === "all" ? "" : filter} alerts.</li> : null}
        </ul>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Condition criteria (threshold rules)">
          <div className="dr-table-wrap"><table className="dr-table"><thead><tr><th>Sensor</th><th>Level</th><th>Rule</th><th>Documented basis</th><th>Enabled</th></tr></thead><tbody>
            {rules.map((r) => <tr key={r.id}><td className="font-mono">{code(r.sensor_id)}</td><td style={{ color: COND_COLOR[r.level] }}>{r.level}</td><td className="font-mono">{r.comparator === "abs_gt" ? "|x| >" : r.comparator === "gt" ? ">" : "<"} {r.threshold}</td><td className="whitespace-normal text-xs">{r.criteria_reference}{r.is_demonstration ? " · DEMONSTRATION" : ""}</td><td>{r.enabled ? "yes" : "no"}</td></tr>)}
          </tbody></table></div>
          <p className="mt-2 text-xs text-muted">Conditions are derived only from these documented criteria. Every change is recorded in the audit trail with before/after values.</p>
        </Panel>
        {can("criteria_edit") ? (
          <Panel title="Add a criterion">
            <form onSubmit={addRule} className="space-y-1">
              <Field label="Sensor"><select className="dr-field" required value={rf.sensor_id} onChange={(e) => setRf({ ...rf, sensor_id: e.target.value })}><option value="">— select —</option>{sensors.map((s) => <option key={s.id} value={s.id}>{s.code} ({s.unit})</option>)}</select></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Level"><select className="dr-field" value={rf.level} onChange={(e) => setRf({ ...rf, level: e.target.value })}><option>attention</option><option>warning</option><option>critical</option></select></Field>
                <Field label="Comparator"><select className="dr-field" value={rf.comparator} onChange={(e) => setRf({ ...rf, comparator: e.target.value })}><option value="gt">&gt;</option><option value="lt">&lt;</option><option value="abs_gt">|x| &gt;</option></select></Field>
                <Field label="Threshold"><input className="dr-field" type="number" step="any" required value={rf.threshold} onChange={(e) => setRf({ ...rf, threshold: e.target.value })} /></Field>
              </div>
              <Field label="Documented basis (required)" hint="Reference to the project-specific approved criterion, e.g. surveillance manual section and revision."><input className="dr-field" required minLength={5} value={rf.criteria_reference} onChange={(e) => setRf({ ...rf, criteria_reference: e.target.value })} /></Field>
              <button className={buttonClass("primary", "sm", "mt-2")}>Add criterion</button>
            </form>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
