"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { formatMeasurement, formatTimestamp } from "@dr/shared-utilities";
import { Cond, Prov, Quality } from "@/components/Badges";
import { EChart } from "@/components/EChart";
import { Panel } from "@/components/ui";
import { useProject, COND_COLOR } from "@/lib/twin";
import { useSeries } from "@/lib/useSeries";

export default function Overview() {
  const { project, readings, alerts, can, subscribe, refresh } = useProject();
  const [sel, setSel] = useState<string | null>(null);
  const selId = sel ?? readings.find((r) => r.condition === "attention" || r.condition === "warning")?.sensor_id ?? readings[0]?.sensor_id ?? null;
  const reading = readings.find((r) => r.sensor_id === selId);
  const start = useMemo(() => new Date(Date.now() - 6 * 3600e3), [selId]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, setData } = useSeries(project.id, selId, start, null, 800);
  useEffect(() => subscribe((ev) => {
    if (ev.type === "observation" && ev.sensor_id === selId) setData((d) => d ? { ...d, points: [...d.points, { t: ev.t, v: ev.v, q: ev.q }].slice(-2000) } : d);
  }), [selId, subscribe, setData]);
  const reporting = readings.filter((r) => r.comms === "online").length;
  const open = alerts.filter((a) => a.status === "open");
  const option = useMemo(() => ({
    xAxis: { type: "time" }, yAxis: { type: "value", scale: true, name: reading?.unit, nameTextStyle: { color: "#9DB3AE" } },
    series: [{ type: "line", name: `${reading?.code ?? ""} (${reading?.source ?? ""})`, showSymbol: false, data: (data?.points ?? []).map((p) => [p.t, p.v]), lineStyle: { width: 1.8 },
      markPoint: { symbolSize: 26, data: (data?.points ?? []).filter((p) => p.q !== "good").slice(-20).map((p) => ({ coord: [p.t, p.v], itemStyle: { color: "#E0AE52" }, name: p.q })) } }],
  }), [data, reading]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="font-display font-extrabold text-[clamp(1.3rem,1.5vw+0.9rem,1.8rem)] text-ivory">{project.assets[0]?.name ?? project.name} — overview</h1>
          <p className="text-sm text-muted">{readings.length} registered sensors · {project.components.length} structural components{project.assets[0]?.is_illustrative ? " · illustrative demonstration model" : ""}</p></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[["Sensors reporting", `${reporting} / ${readings.length}`, `${readings.filter((r) => r.comms === "offline" || r.comms === "never").length} offline · ${readings.filter((r) => r.status === "maintenance").length} maintenance`],
          ["Open alerts", String(open.length), "automated · awaiting review"],
          ["Condition (sensors with criteria)", String(readings.filter((r) => ["normal", "attention", "warning", "critical"].includes(r.condition)).length), `${readings.filter((r) => r.condition === "not_assessed").length} not assessed`],
          ["Data mode", project.data_mode === "simulated" ? "Demonstration" : project.data_mode, project.data_mode === "simulated" ? "simulated stream" : "measured data"]].map(([k, v, h]) => (
          <div key={k} className="rounded-[12px] border border-line bg-surface p-3 min-w-0"><div className="text-xs text-muted">{k}</div><div className="font-mono text-xl sm:text-2xl text-ivory capitalize truncate" title={v}>{v}</div><div className="text-xs text-muted">{h}</div></div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Latest readings" actions={<Link href={`/p/${project.id}/monitoring`} className="text-sm font-semibold text-accent-ink">Open monitoring →</Link>}>
          <div className="dr-table-wrap">
            <table className="dr-table">
              <thead><tr><th>Sensor</th><th>Value</th><th>Timestamp (UTC)</th><th>Source</th><th>Quality</th><th>Comms</th><th>Condition</th></tr></thead>
              <tbody>
                {readings.map((r) => (
                  <tr key={r.sensor_id} className={r.sensor_id === selId ? "bg-surface-2" : ""}>
                    <td><button className="font-semibold text-accent-ink text-left" aria-pressed={r.sensor_id === selId} onClick={() => setSel(r.sensor_id)}>{r.code}</button><div className="text-xs text-muted">{r.name}</div></td>
                    <td className="font-mono text-ivory">{formatMeasurement(r.value, r.unit, 3)}</td>
                    <td className="font-mono text-xs">{formatTimestamp(r.timestamp).replace(" UTC", "")}</td>
                    <td><Prov kind={r.source} /></td><td><Quality q={r.quality} /></td>
                    <td className="text-xs" style={{ color: r.comms === "online" ? "#5FB592" : r.comms === "late" ? "#E0AE52" : "#8E9AA2" }}>{r.comms}</td>
                    <td><Cond level={r.condition} basis={r.condition_basis} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Conditions are shown only where a documented project criterion exists (hover for its basis). Automated conditions are not engineering safety determinations.</p>
        </Panel>
        <div className="space-y-4 min-w-0">
          <Panel title={`${reading?.code ?? ""} · live trend (6 h)`} actions={reading ? <Link href={`/p/${project.id}/model?sensor=${reading.sensor_id}`} className="text-xs text-accent-ink underline">Locate in 3D</Link> : null}>
            {reading ? <><div className="mb-1 flex flex-wrap items-center gap-2 text-sm"><span className="font-mono text-lg text-ivory">{formatMeasurement(reading.value, reading.unit, 3)}</span><Prov kind={reading.source} /><Cond level={reading.condition} basis={reading.condition_basis} /></div>
              <EChart option={option} height={240} ariaLabel={`Live trend of ${reading.code} over the last 6 hours`} />
              <p className="text-xs text-muted">{reading.condition_basis}</p></> : null}
          </Panel>
          <Panel title="Alerts" actions={<Link href={`/p/${project.id}/alerts`} className="text-sm font-semibold text-accent-ink">All alerts →</Link>}>
            <ul className="space-y-2">
              {open.slice(0, 5).map((a) => (
                <li key={a.id} className="rounded-[10px] border border-line p-2.5 text-sm">
                  <div className="flex justify-between gap-2"><span className="font-semibold" style={{ color: COND_COLOR[a.severity] ?? "#E6EEEB" }}>{a.kind.replace("_", " ")} · {a.severity}</span><span className="text-xs text-muted">{formatTimestamp(a.created_at)}</span></div>
                  <div className="text-xs text-muted mt-1">{a.message}</div>
                  {can("alert_ack") ? <button className={buttonClass("secondary", "sm", "mt-2")} onClick={async () => { await apiFetch(`/twin/projects/${project.id}/alerts/${a.id}/acknowledge`, { method: "POST" }); refresh(); }}>Acknowledge</button> : null}
                </li>
              ))}
              {!open.length ? <li className="text-sm text-muted">No open alerts.</li> : null}
            </ul>
            <p className="mt-2 text-xs text-muted">Automated alerts are prompts for review — not engineering safety determinations.</p>
          </Panel>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Link href={`/p/${project.id}/model`} className="rounded-[14px] border border-line bg-surface p-4 hover:border-accent"><div className="font-display font-bold text-ivory">Open 3D structure</div><p className="text-sm text-muted">Select sensors on the model, inspect components and monitoring locations.</p></Link>
        <Panel title="Model updates & reports"><p className="text-sm text-muted">No analytical models have been published to this project yet. Models are published from the Engineering Lab (Stage 5 integration).</p></Panel>
      </div>
    </div>
  );
}
