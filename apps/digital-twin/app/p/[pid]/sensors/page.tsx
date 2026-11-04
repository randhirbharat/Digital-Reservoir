"use client";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, apiUpload } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import { Prov } from "@/components/Badges";
import { ErrorBox, Field, Panel } from "@/components/ui";
import { useProject } from "@/lib/twin";

const EMPTY = { code: "", name: "", sensor_type: "", variable: "", unit: "", component_id: "", x: 0, y: 0, z: 0, frequency_s: 600, source: "live", status: "active", notes: "", calibration: "" };

export default function Sensors() {
  const { project, sensors, readings, can, refresh } = useProject();
  const [f, setF] = useState<any>(EMPTY), [err, setErr] = useState<string | null>(null), [msg, setMsg] = useState<string | null>(null);
  const [gws, setGws] = useState<any[]>([]), [gwName, setGwName] = useState(""), [gwSource, setGwSource] = useState("live"), [newKey, setNewKey] = useState<string | null>(null);
  const [imp, setImp] = useState({ sensor: "", source: "historical" });
  const manage = can("sensors_manage");
  const loadGw = () => manage && apiFetch<any[]>(`/twin/projects/${project.id}/gateways`).then(setGws);
  useEffect(() => { void loadGw(); }, [manage]); // eslint-disable-line react-hooks/exhaustive-deps
  const compName = (id: string | null) => project.components.find((c) => c.id === id)?.name ?? "—";
  async function register(e: FormEvent) {
    e.preventDefault(); setErr(null); setMsg(null);
    try {
      let calibration = {};
      if (f.calibration.trim()) calibration = Object.fromEntries(f.calibration.split(";").map((kv: string) => kv.split("=").map((x) => x.trim())).filter((p: string[]) => p[0]));
      await apiFetch(`/twin/projects/${project.id}/sensors`, { json: { ...f, component_id: f.component_id || null, asset_id: project.assets[0]?.id ?? null, calibration, x: +f.x, y: +f.y, z: +f.z, frequency_s: +f.frequency_s } });
      setF(EMPTY); setMsg("Sensor registered."); refresh();
    } catch (x: any) { setErr(x.detail); }
  }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-4">
      <h1 className="font-display font-extrabold text-xl text-ivory">Sensor registry</h1>
      <Panel title={`${sensors.length} registered sensors`}>
        <div className="dr-table-wrap"><table className="dr-table"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Variable · unit</th><th>Component</th><th>x, y, z (m)</th><th>Frequency</th><th>Source</th><th>Status</th><th>Comms</th><th>Calibration</th></tr></thead><tbody>
          {sensors.map((s) => { const r = readings.find((x) => x.sensor_id === s.id); return (
            <tr key={s.id}><td className="font-mono font-semibold">{s.code}</td><td>{s.name}</td><td>{s.sensor_type}</td><td>{s.variable} · {s.unit}</td><td>{compName(s.component_id)}</td><td className="font-mono">{s.x}, {s.y}, {s.z}</td>
              <td className="font-mono">{s.frequency_s} s</td><td><Prov kind={s.source} /></td><td>{s.status}</td><td>{r?.comms}</td><td className="text-xs">{Object.entries(s.calibration).map(([k, v]) => `${k}: ${v}`).join("; ") || "—"}</td></tr>); })}
        </tbody></table></div>
      </Panel>
      {manage ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Register a sensor">
            <form onSubmit={register} className="grid gap-x-3 sm:grid-cols-2">
              <Field label="Code"><input className="dr-field" required value={f.code} onChange={set("code")} placeholder="PZ-07" /></Field>
              <Field label="Name"><input className="dr-field" required value={f.name} onChange={set("name")} /></Field>
              <Field label="Sensor type"><input className="dr-field" required value={f.sensor_type} onChange={set("sensor_type")} placeholder="Vibrating-wire piezometer" /></Field>
              <Field label="Measurement variable"><input className="dr-field" required value={f.variable} onChange={set("variable")} placeholder="piezometric_head" /></Field>
              <Field label="Engineering unit"><input className="dr-field" required value={f.unit} onChange={set("unit")} placeholder="m" /></Field>
              <Field label="Structural component"><select className="dr-field" value={f.component_id} onChange={set("component_id")}><option value="">— none —</option>{project.components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="x (along crest, m)"><input className="dr-field" type="number" step="any" value={f.x} onChange={set("x")} /></Field>
              <Field label="y (downstream, m)"><input className="dr-field" type="number" step="any" value={f.y} onChange={set("y")} /></Field>
              <Field label="z (above foundation, m)"><input className="dr-field" type="number" step="any" value={f.z} onChange={set("z")} /></Field>
              <Field label="Reading interval (s)"><input className="dr-field" type="number" min={1} value={f.frequency_s} onChange={set("frequency_s")} /></Field>
              <Field label="Data source"><select className="dr-field" value={f.source} onChange={set("source")}><option value="live">Live (gateway)</option><option value="historical">Historical measured</option><option value="imported">Imported third-party</option>{project.data_mode === "simulated" ? <option value="simulated">Simulated (demonstration)</option> : null}</select></Field>
              <Field label="Status"><select className="dr-field" value={f.status} onChange={set("status")}>{["active", "maintenance", "offline", "fault", "decommissioned"].map((s) => <option key={s}>{s}</option>)}</select></Field>
              <div className="sm:col-span-2"><Field label="Calibration (key=value; …)" hint="e.g. gauge_factor=0.0386 kPa/digit; date=2026-02-11"><input className="dr-field" value={f.calibration} onChange={set("calibration")} /></Field></div>
              <div className="sm:col-span-2 pt-2 space-y-2"><ErrorBox>{err}</ErrorBox>{msg ? <p className="text-sm text-[#5FB592]">{msg}</p> : null}<button className={buttonClass("primary", "md")}>Register sensor</button></div>
            </form>
          </Panel>
          <div className="space-y-4">
            <Panel title="Gateways (data connectors)">
              <p className="text-xs text-muted mb-2">Gateways send data to the ingestion API (REST, or MQTT via the bridge). The key is shown once; store it in the gateway's secret store.</p>
              <ul className="space-y-1 text-sm">{gws.map((g) => <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-2 py-1.5"><span>{g.name} · <span className="text-muted">{g.data_source}</span> · {g.revoked_at ? "revoked" : g.last_seen_at ? `last seen ${formatTimestamp(g.last_seen_at)}` : "never connected"}</span>
                {!g.revoked_at ? <button className="text-xs underline text-[#F2B8B8]" onClick={async () => { await apiFetch(`/twin/projects/${project.id}/gateways/${g.id}`, { method: "DELETE" }); loadGw(); }}>Revoke</button> : null}</li>)}</ul>
              <form className="mt-2 flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); const r = await apiFetch<any>(`/twin/projects/${project.id}/gateways`, { json: { name: gwName, data_source: gwSource } }); setNewKey(r.key); setGwName(""); loadGw(); }}>
                <input className="dr-field flex-1 min-w-[160px]" placeholder="Gateway name" required minLength={2} value={gwName} onChange={(e) => setGwName(e.target.value)} />
                <select className="dr-field !w-auto" value={gwSource} onChange={(e) => setGwSource(e.target.value)}><option value="live">live</option><option value="historical">historical</option><option value="imported">imported</option></select>
                <button className={buttonClass("secondary", "md")}>Create key</button></form>
              {newKey ? <p className="mt-2 break-all rounded-lg bg-[#0B1820] p-2 font-mono text-xs">{newKey}</p> : null}
            </Panel>
            <Panel title="Import historical data (CSV)">
              <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); setErr(null); const fd = new FormData(e.currentTarget); fd.set("source", imp.source); try { const r = await apiUpload<any>(`/api/v1/twin/projects/${project.id}/sensors/${imp.sensor}/import`, fd); setMsg(`Imported ${r.rows} rows (${r.skipped} skipped).`); refresh(); } catch (x: any) { setErr(x.detail); } }}>
                <Field label="Sensor"><select className="dr-field" required value={imp.sensor} onChange={(e) => setImp({ ...imp, sensor: e.target.value })}><option value="">— select —</option>{sensors.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></Field>
                <Field label="Provenance"><select className="dr-field" value={imp.source} onChange={(e) => setImp({ ...imp, source: e.target.value })}><option value="historical">Historical measured</option><option value="imported">Imported third-party</option></select></Field>
                <Field label="CSV file" hint="Columns: timestamp (with time zone), value[, quality]"><input type="file" name="file" accept=".csv" required className="dr-field" /></Field>
                <button className={buttonClass("secondary", "sm")}>Import</button>
              </form>
            </Panel>
          </div>
        </div>
      ) : <p className="text-sm text-muted">Your role can view the registry. Registration and gateways require the Project Engineer or Administrator role.</p>}
    </div>
  );
}
