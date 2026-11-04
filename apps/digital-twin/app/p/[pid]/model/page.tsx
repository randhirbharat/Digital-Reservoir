"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { formatMeasurement, formatTimestamp } from "@dr/shared-utilities";
import { Cond, Prov, Quality } from "@/components/Badges";
import type { Layers, Pick } from "@/components/DamScene";
import { EChart } from "@/components/EChart";
import { Panel } from "@/components/ui";
import { useProject } from "@/lib/twin";
import { useSeries } from "@/lib/useSeries";

const DamScene = dynamic(() => import("@/components/DamScene").then((m) => m.DamScene), { ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-muted">Loading 3D engine…</div> });

const PERIODS = [["Last 24 h", 1], ["Last 7 days", 7], ["Last 30 days", 30], ["Last 90 days", 90]] as const;

function Model() {
  const { project, sensors, readings } = useProject();
  const params = useSearchParams();
  const [layers, setLayers] = useState<Layers>({ structure: true, foundation: true, reservoir: true, galleries: true, sensors: true, labels: true });
  const [sel, setSel] = useState<string | null>(params.get("sensor"));
  const [comp, setComp] = useState<Pick | null>(null);
  const [cmp, setCmp] = useState<[number, number]>([7, 30]);
  const asset = project.assets[0];
  const level = readings.find((r) => r.variable === "reservoir_level");
  const levelAbove = level?.value != null && asset?.geometry?.level_datum_m != null ? level.value - asset.geometry.level_datum_m : null;
  const s = sensors.find((x) => x.id === sel), r = readings.find((x) => x.sensor_id === sel);
  const start = useMemo(() => new Date(Date.now() - 7 * 86400e3), [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data } = useSeries(project.id, sel, start, null, 600);
  const startA = useMemo(() => new Date(Date.now() - cmp[1] * 86400e3), [cmp, sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: longData } = useSeries(project.id, sel, startA, null, 5000);
  const stats = (days: number) => {
    const cut = Date.now() - days * 86400e3;
    const v = (longData?.points ?? []).filter((p) => new Date(p.t).getTime() >= cut && p.v !== null).map((p) => p.v as number);
    return v.length ? { mean: v.reduce((a, b) => a + b, 0) / v.length, min: Math.min(...v), max: Math.max(...v), n: v.length } : null;
  };
  const compName = (id: string | null) => project.components.find((c) => c.id === id)?.name ?? "—";
  const compSensors = comp ? sensors.filter((x) => { const c = project.components.find((k) => k.id === x.component_id); return c && (c.code === comp.id || (comp.id === "GAL" && c.kind === "gallery") || (comp.id === "JOINT" && c.kind === "joint")); }) : [];
  const layerList: [keyof Layers, string, string][] = [["structure", "Dam structure", "#C9D6D0"], ["reservoir", "Reservoir", "#2C8C9E"], ["foundation", "Foundation", "#4E5E63"], ["galleries", "Galleries", "#E0AE52"], ["sensors", "Sensors", "#72BEB1"], ["labels", "Sensor labels", "#E6EEEB"]];
  if (!asset) return <Panel><p className="text-sm">No structure model is registered for this project. Upload a GLB/glTF model (IFC via conversion) to enable the 3D view.</p></Panel>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display font-extrabold text-xl text-ivory">3D structure · {asset.name}</h1>
        {asset.is_illustrative ? <span className="rounded-full border border-bronze px-3 py-1 text-[0.68rem] font-bold tracking-[0.08em] text-[#D8C49E]">ILLUSTRATIVE DEMONSTRATION MODEL · NOT AN EXISTING DAM</span> : null}
      </div>
      <div className="grid gap-3 xl:grid-cols-[230px_minmax(0,1fr)_340px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3 lg:col-span-2 xl:col-span-1 grid sm:grid-cols-2 xl:grid-cols-1 gap-3 xl:block">
          <Panel title="Layers">
            {layerList.map(([k, label, color]) => (
              <label key={k} className="flex items-center gap-2.5 min-h-[34px] text-sm"><input type="checkbox" className="size-4 accent-[#72BEB1]" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /><span className="size-3 rounded-sm" style={{ background: color }} />{label}</label>
            ))}
          </Panel>
          <Panel title="Sensors">
            <ul className="max-h-[320px] overflow-y-auto space-y-0.5" aria-label="Sensors (keyboard alternative to the 3D view)">
              {readings.map((x) => (
                <li key={x.sensor_id}><button aria-pressed={sel === x.sensor_id} onClick={() => setSel(x.sensor_id)} className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${sel === x.sensor_id ? "bg-surface-2 text-ivory" : "hover:bg-surface-2"}`}>
                  <span className="font-mono">{x.code}</span><Cond level={x.condition} basis={x.condition_basis} /></button></li>
              ))}
            </ul>
          </Panel>
        </div>
        <section className="relative min-w-0 overflow-hidden rounded-[14px] border border-line bg-[#0B1820] h-[clamp(360px,62vh,640px)]">
          <DamScene geometry={asset.geometry} sensors={sensors} readings={readings} layers={layers} selected={sel} levelM={levelAbove} focusKey={params.get("sensor")}
            onPick={(p) => { if (p.kind === "sensor") { setSel(p.id); } else setComp(p); }} />
          <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex flex-wrap justify-between gap-2 text-[0.7rem] text-muted">
            <span>Drag to rotate · right-drag / two fingers to pan · scroll / pinch to zoom · click sensors or surfaces</span>
            <span>Reservoir: {level ? formatMeasurement(level.value, level.unit, 2) : "—"} ({level?.source ?? "—"})</span>
          </div>
        </section>
        <div className="space-y-3 min-w-0">
          {s && r ? (
            <Panel title={s.code} actions={<Cond level={r.condition} basis={r.condition_basis} />}>
              <div className="text-sm text-muted">{s.name}</div>
              <div className="mt-2 font-mono text-2xl text-ivory">{formatMeasurement(r.value, r.unit, 3)}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">{formatTimestamp(r.timestamp)} <Prov kind={r.source} /> quality <Quality q={r.quality} /> · comms {r.comms}</div>
              <EChart height={150} ariaLabel={`Seven-day trend of ${s.code}`} option={{ grid: { left: 44, right: 8, top: 10, bottom: 24 }, xAxis: { type: "time" }, yAxis: { type: "value", scale: true }, legend: { show: false }, series: [{ type: "line", showSymbol: false, data: (data?.points ?? []).map((p) => [p.t, p.v]) }] }} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {[["Type", s.sensor_type], ["Variable", `${s.variable} · ${s.unit}`], ["Component", compName(s.component_id)], ["Coordinates", `x ${s.x} · y ${s.y} · z ${s.z} m`], ["Frequency", `every ${s.frequency_s} s`],
                  ["Data source", s.source], ["Status", s.status], ["Calibration", Object.keys(s.calibration).length ? Object.entries(s.calibration).map(([k, v]) => `${k}: ${v}`).join("; ") : "not recorded"]].map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="m-0 font-mono break-words">{v}</dd></div>)}
              </dl>
              <p className="mt-2 text-xs text-muted">{r.condition_basis}</p>
              <Link href={`/p/${project.id}/monitoring?sensor=${s.id}`} className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-[9px] bg-aqua font-bold text-navy">Open full trend</Link>
            </Panel>
          ) : <Panel><p className="text-sm text-muted">Select a sensor on the model or in the list.</p></Panel>}
          {comp ? (
            <Panel title={comp.label} actions={<button className="text-xs underline" onClick={() => setComp(null)}>Clear</button>}>
              {comp.point ? <p className="font-mono text-xs text-muted">x {comp.point[0]} · y {comp.point[1]} · z {comp.point[2]} m</p> : null}
              <p className="mt-1 text-sm">{compSensors.length ? "Sensors on this component:" : "No sensors registered on this component."}</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">{compSensors.map((x) => <li key={x.id}><button className="rounded-full border border-line px-2 py-0.5 font-mono text-xs" onClick={() => setSel(x.id)}>{x.code}</button></li>)}</ul>
            </Panel>
          ) : null}
          {s ? (
            <Panel title="Compare monitoring periods">
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((i) => <select key={i} aria-label={`Period ${i ? "B" : "A"}`} className="dr-field" value={cmp[i]} onChange={(e) => { const c = [...cmp] as [number, number]; c[i] = Number(e.target.value); setCmp(c); }}>{PERIODS.map(([l, d]) => <option key={d} value={d}>{l}</option>)}</select>)}
              </div>
              <div className="dr-table-wrap mt-2"><table className="dr-table"><thead><tr><th><span className="sr-only">Statistic</span></th><th>Period A</th><th>Period B</th></tr></thead><tbody>
                {(["mean", "min", "max", "n"] as const).map((k) => { const a = stats(cmp[0]), b = stats(cmp[1]); return <tr key={k}><td className="text-muted">{k}</td><td className="font-mono">{a ? (k === "n" ? a.n : a[k].toFixed(3)) : "—"}</td><td className="font-mono">{b ? (k === "n" ? b.n : b[k].toFixed(3)) : "—"}</td></tr>; })}
              </tbody></table></div>
              <p className="mt-1 text-xs text-muted">Unit: {s.unit}. Statistics over stored observations (display samples).</p>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><Model /></Suspense>; }
