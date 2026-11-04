"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { apiDownload, apiFetch } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { formatMeasurement, formatTimestamp } from "@dr/shared-utilities";
import { Cond, Prov } from "@/components/Badges";
import { EChart } from "@/components/EChart";
import { Panel } from "@/components/ui";
import { useProject, VARIABLE_LABEL, COND_COLOR } from "@/lib/twin";
import type { ObsResponse } from "@/lib/useSeries";
import { ModelEvaluation, usePublications } from "@/components/ModelPanels";
import { appUrls } from "@dr/shared-utilities";

const WINDOWS = [["Live · 1 h", 1 / 24], ["24 h", 1], ["7 days", 7], ["30 days", 30], ["90 days", 90], ["Custom", -1]] as const;
const RATES = [["Live stream", 0], ["Poll 30 s", 30], ["Poll 5 min", 300], ["Paused", -1]] as const;
const PALETTE = ["#72BEB1", "#C9B591", "#8FB8E0", "#E0844F", "#B9C2BE"];

function useMulti(pid: string, ids: string[], start: Date, end: Date | null, tick: number) {
  const [data, setData] = useState<Record<string, ObsResponse>>({});
  const key = ids.join(",");
  const load = useCallback(async () => {
    const qs = (id: string) => `/twin/projects/${pid}/sensors/${id}/observations?` + new URLSearchParams({ start: start.toISOString(), max_points: "1500", ...(end ? { end: end.toISOString() } : {}) });
    const res = await Promise.all(ids.map((id) => apiFetch<ObsResponse>(qs(id)).then((r) => [id, r] as const).catch(() => null)));
    setData(Object.fromEntries(res.filter(Boolean) as [string, ObsResponse][]));
  }, [pid, key, start, end, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  return { data, setData };
}

function Monitoring() {
  const { project, sensors, readings, subscribe, can } = useProject();
  const params = useSearchParams();
  const groups = useMemo(() => Array.from(new Set(sensors.map((s) => s.variable))), [sensors]);
  const initial = sensors.find((s) => s.id === params.get("sensor"));
  const [group, setGroup] = useState<string>(initial?.variable ?? groups.find((g) => g === "piezometric_head") ?? groups[0]);
  const inGroup = sensors.filter((s) => s.variable === group);
  const [picked, setPicked] = useState<string[]>(initial ? [initial.id] : []);
  const shown = (picked.filter((id) => inGroup.some((s) => s.id === id)).length ? picked.filter((id) => inGroup.some((s) => s.id === id)) : inGroup.map((s) => s.id)).slice(0, 5);
  const [win, setWin] = useState<number>(1), [rate, setRate] = useState<number>(0), [tick, setTick] = useState(0);
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [showTh, setShowTh] = useState(true), [showLevel, setShowLevel] = useState(true);
  const [rules, setRules] = useState<any[]>([]);
  const [clicked, setClicked] = useState<{ id: string; t: string; v: number } | null>(null);
  const [replay, setReplay] = useState(100);
  const pubs = usePublications(project.id);
  const [exported, setExported] = useState<string | null>(null);
  useEffect(() => { apiFetch<any[]>(`/twin/projects/${project.id}/rules`).then(setRules).catch(() => setRules([])); }, [project.id]);
  const range = useMemo(() => {
    if (win === -1 && custom.start) return { start: new Date(custom.start + "T00:00:00Z"), end: custom.end ? new Date(custom.end + "T23:59:59Z") : null };
    return { start: new Date(Date.now() - (win === -1 ? 7 : win) * 86400e3), end: null };
  }, [win, custom, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const levelSensor = sensors.find((s) => s.variable === "reservoir_level");
  const ids = useMemo(() => Array.from(new Set([...shown, ...(levelSensor ? [levelSensor.id] : [])])), [shown.join(","), levelSensor?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, setData } = useMulti(project.id, ids, range.start, range.end, tick);
  useEffect(() => { if (rate > 0) { const t = setInterval(() => setTick((x) => x + 1), rate * 1000); return () => clearInterval(t); } }, [rate]);
  useEffect(() => subscribe((ev) => {
    if (rate !== 0 || range.end || ev.type !== "observation" || !ids.includes(ev.sensor_id)) return;
    setData((d) => d[ev.sensor_id] ? { ...d, [ev.sensor_id]: { ...d[ev.sensor_id], points: [...d[ev.sensor_id].points, { t: ev.t, v: ev.v, q: ev.q }] } } : d);
  }), [subscribe, rate, range.end, ids.join(","), setData]); // eslint-disable-line react-hooks/exhaustive-deps

  const unit = inGroup[0]?.unit ?? "";
  const groupRules = rules.filter((r) => shown.includes(r.sensor_id));
  const option = useMemo(() => {
    const series: any[] = shown.map((id, i) => {
      const s = sensors.find((x) => x.id === id)!;
      const pts = data[id]?.points ?? [];
      return {
        type: "line", name: s.code, showSymbol: false, sampling: "lttb", yAxisIndex: 0, lineStyle: { width: 1.7, color: PALETTE[i] }, itemStyle: { color: PALETTE[i] }, data: pts.map((p) => [p.t, p.v, p.q]),
        markPoint: { symbolSize: 22, label: { show: false }, data: pts.filter((p) => p.q !== "good" && p.q !== "unchecked").slice(-30).map((p) => ({ coord: [p.t, p.v ?? 0], name: p.q, itemStyle: { color: p.q === "missing" ? "#8E9AA2" : "#E0AE52" } })) },
        markLine: showTh ? { symbol: "none", label: { color: "#E6EEEB", fontSize: 10, formatter: "{b}" }, data: groupRules.filter((r) => r.sensor_id === id && r.enabled).map((r) => ({ yAxis: r.threshold, name: `${s.code} ${r.level} ${r.threshold}${r.is_demonstration ? " (demo)" : ""}`, lineStyle: { color: COND_COLOR[r.level], type: "dashed" } })) } : undefined,
      };
    });
    if (showLevel && levelSensor && group !== "reservoir_level")
      series.push({ type: "line", name: `${levelSensor.code} (level)`, yAxisIndex: 1, showSymbol: false, areaStyle: { opacity: 0.12, color: "#2C8C9E" }, lineStyle: { width: 1, color: "#2C8C9E" }, data: (data[levelSensor.id]?.points ?? []).map((p) => [p.t, p.v]) });
    return {
      xAxis: { type: "time" }, dataZoom: [{ type: "inside" }, { type: "slider", height: 18, bottom: 26, borderColor: "#26434D", textStyle: { color: "#9DB3AE" } }],
      yAxis: [{ type: "value", scale: true, name: unit, nameTextStyle: { color: "#9DB3AE" } }, ...(showLevel && levelSensor && group !== "reservoir_level" ? [{ type: "value", scale: true, name: levelSensor.unit, position: "right", splitLine: { show: false }, nameTextStyle: { color: "#9DB3AE" } }] : [])],
      grid: { bottom: 80, right: showLevel ? 60 : 18 }, series, legend: { bottom: 0 },
    };
  }, [data, shown.join(","), showTh, showLevel, groupRules, levelSensor, group, unit, sensors]); // eslint-disable-line react-hooks/exhaustive-deps

  // correlation of first shown sensor with reservoir level (nearest-hour alignment)
  const corr = useMemo(() => {
    const a = data[shown[0]]?.points, b = levelSensor ? data[levelSensor.id]?.points : undefined;
    if (!a || !b || shown[0] === levelSensor?.id) return null;
    const lv = new Map(b.filter((p) => p.v !== null).map((p) => [Math.round(new Date(p.t).getTime() / 3600e3), p.v as number]));
    const pairs = a.map((p) => [lv.get(Math.round(new Date(p.t).getTime() / 3600e3)), p.v] as const).filter(([x, y]) => x != null && y != null) as [number, number][];
    if (pairs.length < 5) return null;
    const n = pairs.length, mx = pairs.reduce((s, p) => s + p[0], 0) / n, my = pairs.reduce((s, p) => s + p[1], 0) / n;
    const sxy = pairs.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0), sxx = pairs.reduce((s, p) => s + (p[0] - mx) ** 2, 0), syy = pairs.reduce((s, p) => s + (p[1] - my) ** 2, 0);
    return { pairs, r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx, n };
  }, [data, shown.join(","), levelSensor]); // eslint-disable-line react-hooks/exhaustive-deps

  // historical replay: state of each shown sensor at the selected point in the window
  const replayTime = useMemo(() => {
    const s0 = range.start.getTime(), e0 = (range.end ?? new Date()).getTime();
    return new Date(s0 + (replay / 100) * (e0 - s0));
  }, [replay, range]);
  const at = (id: string) => { const pts = data[id]?.points ?? []; let best = null as null | { t: string; v: number | null; q: string }; for (const p of pts) { if (new Date(p.t) <= replayTime) best = p; else break; } return best; };
  const condAt = (id: string, v: number | null) => {
    if (v == null) return "unavailable" as const;
    const hits = rules.filter((r) => r.sensor_id === id && r.enabled && (r.comparator === "gt" ? v > r.threshold : r.comparator === "lt" ? v < r.threshold : Math.abs(v) > r.threshold));
    if (!rules.some((r) => r.sensor_id === id)) return "not_assessed" as const;
    return hits.length ? (hits.some((h) => h.level === "critical") ? "critical" : hits.some((h) => h.level === "warning") ? "warning" : "attention") as any : "normal" as const;
  };
  const availability = (id: string) => {
    const s = sensors.find((x) => x.id === id)!, d = data[id];
    if (!d) return null;
    const span = ((range.end ?? new Date()).getTime() - range.start.getTime()) / 1000;
    return Math.min(100, (100 * d.n_total) / Math.max(1, span / s.frequency_s));
  };
  return (
    <div className="space-y-3">
      <h1 className="font-display font-extrabold text-xl text-ivory">Instrumentation monitoring</h1>
      <div role="tablist" aria-label="Instrument group" className="flex gap-1.5 overflow-x-auto pb-1">
        {groups.map((g) => <button key={g} role="tab" aria-selected={g === group} onClick={() => { setGroup(g); setPicked([]); }} className={`whitespace-nowrap rounded-[9px] border px-3 min-h-[40px] text-sm font-semibold ${g === group ? "border-aqua bg-surface-2 text-ivory" : "border-line bg-surface text-muted"}`}>{VARIABLE_LABEL[g] ?? g}</button>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-line bg-surface p-2.5">
        <div role="group" aria-label="Time window" className="flex flex-wrap gap-1">{WINDOWS.map(([l, d]) => <button key={l} aria-pressed={win === d} onClick={() => setWin(d)} className={`rounded-[8px] border px-3 min-h-[36px] text-sm ${win === d ? "border-aqua bg-aqua text-navy font-bold" : "border-line text-muted"}`}>{l}</button>)}</div>
        {win === -1 ? <div className="flex items-center gap-2 text-sm"><input type="date" aria-label="Start date (UTC)" className="dr-field !min-h-[36px] !py-1" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} /><span>→</span><input type="date" aria-label="End date (UTC)" className="dr-field !min-h-[36px] !py-1" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} /></div> : null}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <label className="flex items-center gap-1.5">Refresh<select className="dr-field !min-h-[34px] !py-0 !w-auto" value={rate} onChange={(e) => setRate(Number(e.target.value))}>{RATES.map(([l, v]) => <option key={l} value={v}>{l}</option>)}</select></label>
          <label className="flex items-center gap-1.5 min-h-[34px]"><input type="checkbox" className="size-4" checked={showTh} onChange={(e) => setShowTh(e.target.checked)} />Criteria lines</label>
          <label className="flex items-center gap-1.5 min-h-[34px]"><input type="checkbox" className="size-4" checked={showLevel} onChange={(e) => setShowLevel(e.target.checked)} />Reservoir level</label>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-3 min-w-0">
          <Panel title={`${VARIABLE_LABEL[group] ?? group} · ${unit} · UTC`} actions={<div role="group" aria-label="Compare sensors" className="flex flex-wrap gap-1.5">{inGroup.map((s) => {
            const on = shown.includes(s.id);
            return <button key={s.id} aria-pressed={on} onClick={() => setPicked(on ? shown.filter((x) => x !== s.id) : [...shown, s.id])} className={`rounded-full border px-2.5 min-h-[32px] font-mono text-xs ${on ? "border-aqua text-ivory" : "border-line text-muted line-through"}`}>{s.code}</button>; })}</div>}>
            <EChart option={option} notMerge height={380} ariaLabel={`${VARIABLE_LABEL[group]} for ${shown.length} sensors`} onClick={(p) => { if (p.seriesName && Array.isArray(p.value)) { const s = sensors.find((x) => x.code === p.seriesName); if (s) setClicked({ id: s.id, t: p.value[0], v: p.value[1] }); } }} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>Quality flags: <span className="text-[#E0AE52]">● suspect</span> <span className="text-[#8E9AA2]">● missing</span></span>
              {Object.values(data).some((d) => d.downsampled) ? <span>Display downsampled (LTTB, ≤1500 points per series); stored measurements unchanged.</span> : null}
              {clicked ? <span className="text-ivory">Selected {sensors.find((s) => s.id === clicked.id)?.code} at {formatTimestamp(clicked.t)} = {clicked.v?.toFixed(3)} {unit} · <Link className="underline text-accent-ink" href={`/p/${project.id}/model?sensor=${clicked.id}`}>Locate in 3D</Link></span> : <span>Click a point to locate its sensor in 3D.</span>}
            </div>
          </Panel>
          {(() => { const m = pubs.find((p) => p.active && shown.includes(p.sensor_id)); return m ? <Panel title={`Published model · HST v${m.version} on ${m.sensor_code}`}><ModelEvaluation pid={project.id} model={m} start={range.start} end={range.end} /></Panel> : null; })()}
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Correlation with reservoir level">
              {corr ? <><EChart height={230} ariaLabel="Scatter of the first selected sensor against reservoir level" option={{ tooltip: { trigger: "item" }, legend: { show: false }, grid: { left: 52, bottom: 36 }, xAxis: { type: "value", scale: true, name: levelSensor?.unit, nameLocation: "middle", nameGap: 24 }, yAxis: { type: "value", scale: true, name: unit }, series: [{ type: "scatter", symbolSize: 4, data: corr.pairs, itemStyle: { color: "#72BEB1", opacity: 0.6 } }] }} />
                <p className="text-xs text-muted">{sensors.find((s) => s.id === shown[0])?.code}: r = {corr.r.toFixed(2)}, slope {corr.slope.toFixed(3)} {unit}/m, n = {corr.n}. Descriptive only — lags and thermal effects need the HST model.</p></> : <p className="text-sm text-muted">Select a non-level group with overlapping reservoir data.</p>}
            </Panel>
            <Panel title="Historical replay">
              <label className="block text-xs text-muted">Position · {formatTimestamp(replayTime)}<input type="range" min={0} max={100} value={replay} onChange={(e) => setReplay(Number(e.target.value))} className="w-full accent-[#72BEB1]" /></label>
              <div className="dr-table-wrap mt-2"><table className="dr-table"><thead><tr><th>Sensor</th><th>Value then</th><th>Condition then</th></tr></thead><tbody>
                {[...shown, ...(levelSensor && !shown.includes(levelSensor.id) ? [levelSensor.id] : [])].map((id) => { const p = at(id), s = sensors.find((x) => x.id === id)!; return <tr key={id}><td className="font-mono">{s.code}</td><td className="font-mono">{p ? formatMeasurement(p.v, s.unit, 3) : "—"}</td><td><Cond level={condAt(id, p?.v ?? null)} /></td></tr>; })}
              </tbody></table></div>
              <p className="mt-1 text-xs text-muted">Conditions re-evaluated against the current criteria; criteria changes are recorded in the audit trail.</p>
            </Panel>
          </div>
        </div>
        <Panel title="Sensors in view">
          <ul className="space-y-2">
            {shown.map((id, i) => { const s = sensors.find((x) => x.id === id)!, r = readings.find((x) => x.sensor_id === id); const av = availability(id); return (
              <li key={id} className="rounded-[10px] border border-line p-2.5">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold text-ivory"><span className="mr-1.5 inline-block size-2.5 rounded-full" style={{ background: PALETTE[i] }} />{s.code}</span><span className="font-mono text-sm">{formatMeasurement(r?.value, s.unit, 3)}</span></div>
                <div className="text-xs text-muted">{s.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">last {formatTimestamp(r?.timestamp)} · comms {r?.comms} {r ? <Prov kind={r.source} /> : null}</div>
                <div className="mt-1.5 h-1.5 rounded bg-[#0B1820]" aria-hidden><div className="h-1.5 rounded bg-[#5FB592]" style={{ width: `${av ?? 0}%` }} /></div>
                <div className="flex justify-between text-[0.7rem] text-muted"><span>availability {av !== null ? `${av.toFixed(1)} %` : "—"} (window)</span>
                  {can("export") ? <button className="underline" onClick={() => apiDownload(`/twin/projects/${project.id}/sensors/${id}/observations.csv?start=${encodeURIComponent(range.start.toISOString())}`, `${project.code}_${s.code}.csv`)}>Export CSV</button> : null}</div>
              </li>); })}
          </ul>
          <p className="mt-2 text-xs text-muted">Refresh: {rate === 0 ? "live WebSocket stream" : rate > 0 ? `polling every ${rate} s` : "paused"}. Every value shows its unit, timestamp and provenance.</p>
          <button className={buttonClass("secondary", "sm", "mt-2 w-full")} onClick={() => setTick((x) => x + 1)}>Reload window</button>
          {can("export") ? <button className={buttonClass("primary", "sm", "mt-2 w-full")} onClick={async () => { const r = await apiFetch<any>(`/twin/projects/${project.id}/export-to-lab`, { json: { sensor_ids: [...shown, ...(levelSensor && !shown.includes(levelSensor.id) ? [levelSensor.id] : [])], start: range.start.toISOString(), end: (range.end ?? new Date()).toISOString() } }).catch((e) => { alert(e.detail); return null; }); if (r) setExported(r.dataset_id); }}>Analyse in Engineering Lab</button> : null}
          {exported ? <p className="mt-1 text-xs">Exported to your Lab datasets. <a className="underline text-accent-ink" href={`${appUrls().lab}/datasets/${exported}`} target="_blank" rel="noopener">Open dataset</a></p> : null}
        </Panel>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><Monitoring /></Suspense>; }
