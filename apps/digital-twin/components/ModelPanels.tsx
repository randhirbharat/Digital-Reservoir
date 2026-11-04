"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@dr/authentication";
import { formatNumber, formatTimestamp } from "@dr/shared-utilities";
import { EChart } from "./EChart";

export function usePublications(pid: string) {
  const [pubs, setPubs] = useState<any[]>([]);
  useEffect(() => { apiFetch<any[]>(`/twin/projects/${pid}/models`).then(setPubs).catch(() => setPubs([])); }, [pid]);
  return pubs;
}

export function PublicationList({ pubs }: { pubs: any[] }) {
  if (!pubs.length) return <p className="text-sm text-muted">No analytical models have been published to this project yet. Fit an HST model in the Engineering Lab and use “Publish to Digital Twin”.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {pubs.slice(0, 6).map((m) => (
        <li key={m.id} className="rounded-[10px] border border-line p-2.5">
          <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-ivory">HST v{m.version} · {m.sensor_code} {m.active ? "" : "(superseded)"}</span><span className="text-xs text-muted">{formatTimestamp(m.published_at)}</span></div>
          <div className="text-xs text-muted">Calibration {formatTimestamp(m.calibration_period[0]).slice(0, 11)} → {formatTimestamp(m.calibration_period[1]).slice(0, 11)} · validation RMSE {m.validation_metrics ? formatNumber(m.validation_metrics.RMSE) : "—"} · calibrated on <strong>{m.calibration_data_provenance}</strong> data{m.deviation_threshold ? ` · deviation alerts at |z| > ${m.deviation_threshold}` : ""}</div>
        </li>
      ))}
    </ul>
  );
}

/** Observed vs published-model prediction and residuals for a sensor over a window. */
export function ModelEvaluation({ pid, model, start, end }: { pid: string; model: any; start: Date; end: Date | null }) {
  const [ev, setEv] = useState<any>(null);
  useEffect(() => {
    const qs = new URLSearchParams({ start: start.toISOString(), ...(end ? { end: end.toISOString() } : {}) });
    apiFetch(`/twin/projects/${pid}/models/${model.id}/evaluation?${qs}`).then(setEv).catch(() => setEv(null));
  }, [pid, model.id, start, end]);
  if (!ev) return null;
  if (!ev.n) return <p className="text-sm text-muted">{ev.note}</p>;
  const s = ev.series;
  return (
    <div className="space-y-2">
      <EChart height={240} ariaLabel={`Observed versus HST v${model.version} prediction for ${model.sensor_code}`} option={{ xAxis: { type: "time" }, yAxis: { type: "value", scale: true }, series: [
        { type: "line", name: "observed", showSymbol: false, data: s.observed.x.map((x: string, i: number) => [x, s.observed.y[i]]) },
        { type: "line", name: `HST v${model.version} prediction`, showSymbol: false, lineStyle: { type: "dashed" }, data: s.predicted.x.map((x: string, i: number) => [x, s.predicted.y[i]]) }] }} />
      <EChart height={170} ariaLabel="Standardised residuals" option={{ xAxis: { type: "time" }, yAxis: { type: "value" }, legend: { show: false }, series: [{ type: "line", name: "standardised residual", showSymbol: false, data: s.std_residual.x.map((x: string, i: number) => [x, s.std_residual.y[i]]),
        markLine: model.deviation_threshold ? { symbol: "none", data: [{ yAxis: model.deviation_threshold }, { yAxis: -model.deviation_threshold }], lineStyle: { color: "#E0AE52", type: "dashed" } } : undefined }] }} />
      <p className="text-xs text-muted">n = {ev.n} · RMSE {formatNumber(ev.rmse)} · max |z| {formatNumber(ev.max_abs_std_residual)} · σ (calibration) {formatNumber(ev.sigma_calibration)} · level alignment: {ev.level_alignment}. Model version {model.version}, executed {formatTimestamp(new Date())}.</p>
      {ev.warnings?.map((w: string) => <p key={w} className="text-xs text-[#E0AE52]">{w}</p>)}
    </div>
  );
}
