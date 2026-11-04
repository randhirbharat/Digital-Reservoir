"use client";
import { useState } from "react";
import { apiFetch } from "@dr/authentication";
import { buttonClass, ProvenanceBadge } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import type { Run } from "@/lib/types";
import { Plot, line, seriesTable } from "./Plot";
import { DataTable, ErrorBox, Field, KV, Warnings, fmt } from "./ui";

export function HybridResult({ r }: { r: any }) {
  const s = r.series, m = r.metrics, end = r.periods.calibration[1];
  const shape = { type: "line", x0: end, x1: end, yref: "paper", y0: 0, y1: 1, line: { color: "#9B8461", dash: "dot" } };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[["Physics only · validation RMSE", fmt(m.physics_only_validation.RMSE)], ["Hybrid · validation RMSE", fmt(m.hybrid_validation.RMSE)], ["Change vs physics only", r.validation_rmse_change_percent != null ? `${r.validation_rmse_change_percent.toFixed(1)} %` : "—"]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-3"><div className="text-xs text-muted">{k}</div><div className="font-mono text-lg">{v} {k.includes("RMSE") ? r.unit : ""}</div></div>))}
      </div>
      <div className="dr-equation">{r.formula}</div>
      <p className="text-sm"><strong>Physics part:</strong> {r.physics_component}</p>
      <Plot ariaLabel="Observed, physics-only and hybrid predictions" layout={{ shapes: [shape] }} data={[line("Observed", s.observed, { line: { color: "#9B8461", width: 1.2 } }), line("Physics only", s.physics, { line: { color: "#5B7FA6", dash: "dash" } }), line("Hybrid", s.hybrid, { line: { color: "#183C45", width: 2 } })].filter(Boolean)}
        table={seriesTable([["observed", s.observed], ["physics", s.physics], ["hybrid", s.hybrid]])} />
      <Plot height={220} ariaLabel="Learned data-driven correction" layout={{ shapes: [shape] }} data={[line("ML correction g(x)", s.ml_correction, { line: { color: "#C0612B" } })]} />
      <DataTable rows={[["Physics only", "calibration", m.physics_only_calibration], ["Physics only", "validation", m.physics_only_validation], ["Hybrid", "calibration", m.hybrid_calibration], ["Hybrid", "validation", m.hybrid_validation]].map(([model, per, x]: any) => ({ model, period: per, n: x.n, MAE: x.MAE, RMSE: x.RMSE, R2: x.R2 }))} />
      <KV items={[["ML part", `${r.ml_component.model} on ${r.ml_component.features.join(", ")}`], ["Data share of variance (validation)", `${(r.data_share_of_variance_validation * 100).toFixed(1)} %`], ["Importance", r.ml_component.impurity_importance.map((i: any) => `${i.feature} ${i.importance.toFixed(2)}`).join(", ")]]} />
      <ul className="list-disc pl-5 text-sm">{r.assumptions.map((a: string) => <li key={a}>{a}</li>)}</ul>
      <Warnings items={r.warnings} />
    </div>
  );
}

export function FragilityResult({ r }: { r: any }) {
  const c = r.curve;
  return (
    <div className="space-y-4">
      <div className="dr-equation">{r.equation}</div>
      <KV items={[["Median θ", `${fmt(r.theta)} ${r.ci_90 ? `(90 % CI ${fmt(r.ci_90.theta[0])}–${fmt(r.ci_90.theta[1])})` : ""}`], ["Dispersion β", `${fmt(r.beta)} ${r.ci_90 ? `(90 % CI ${fmt(r.ci_90.beta[0])}–${fmt(r.ci_90.beta[1])})` : ""}`], ["Basis", r.basis], ["Bootstrap samples", r.n_bootstrap], ["AIC", fmt(r.aic)]]} />
      <Plot ariaLabel={`Fragility curve for ${r.damage_state}`} layout={{ xaxis: { title: { text: r.im_label } }, yaxis: { title: { text: `P(${r.damage_state} | IM)` }, range: [0, 1] } }}
        data={[...(c.band ? [{ type: "scatter", mode: "lines", x: c.im, y: c.band.p95, line: { width: 0 }, showlegend: false }, { type: "scatter", mode: "lines", name: "90 % bootstrap band", x: c.im, y: c.band.p05, fill: "tonexty", fillcolor: "rgba(114,190,177,0.3)", line: { width: 0 } }] : []),
          { type: "scatter", mode: "lines", name: "Fitted lognormal", x: c.im, y: c.p, line: { color: "#183C45", width: 2.4 } },
          { type: "scatter", mode: "markers", name: "Observed fraction", x: r.observed.im, y: r.observed.fraction, marker: { color: "#9B8461", size: 8 } }]}
        table={{ columns: ["IM", "observed fraction", "n"], rows: r.observed.im.map((x: number, i: number) => [x, r.observed.fraction[i], r.observed.n[i]]) }} />
      <DataTable rows={r.probabilities_at.map((x: any) => ({ IM: x.im, "P(exceed)": x.p }))} />
      <p className="text-sm text-muted">{r.record_to_record_note}</p>
      <ul className="list-disc pl-5 text-sm">{r.limitations.map((a: string) => <li key={a}>{a}</li>)}</ul>
      <Warnings items={r.warnings} />
    </div>
  );
}

export function ModalResult({ r }: { r: any }) {
  return (
    <div className="space-y-4">
      <Plot ariaLabel="Singular values of the cross-spectral density matrix (FDD)" layout={{ yaxis: { type: "log", title: { text: "Singular value" } }, xaxis: { title: { text: "Frequency (Hz)" } },
        shapes: r.modes.map((m: any) => ({ type: "line", x0: m.frequency_hz, x1: m.frequency_hz, yref: "paper", y0: 0, y1: 1, line: { color: "#9B8461", dash: "dot" } })) }}
        data={r.spectrum.singular_values.map((sv: number[], i: number) => ({ type: "scatter", mode: "lines", name: `SV${i + 1}`, x: r.spectrum.f, y: sv, line: { width: i ? 1 : 2 } }))} />
      <DataTable rows={r.modes.map((m: any, i: number) => ({ mode: i + 1, "frequency (Hz)": m.frequency_hz, "damping (half-power)": m.damping_ratio_half_power ?? "n/a", shape: m.shape_real.map((v: number) => v.toFixed(2)).join(" / ") }))} />
      {r.modes.length > 1 ? <><h3 className="font-semibold text-sm">Modal assurance criterion (MAC)</h3><Plot height={240} ariaLabel="MAC matrix" layout={{ yaxis: { autorange: "reversed" } }} data={[{ type: "heatmap", z: r.mac, zmin: 0, zmax: 1, colorscale: [[0, "#F5F4EF"], [1, "#183C45"]], text: r.mac.map((row: number[]) => row.map((v) => v.toFixed(2))), texttemplate: "%{text}" }]} /></> : null}
      <KV items={[["Sampling", `${fmt(r.fs_hz)} Hz, ${r.n_samples} samples`], ["Welch", `${r.welch.nperseg}-sample Hann segments, 50 % overlap, Δf = ${fmt(r.welch.frequency_resolution_hz)} Hz`], ["Channels", r.channels.join(", ")]]} />
      <ul className="list-disc pl-5 text-sm">{r.notes.map((n: string) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}

export function VisionResult({ run }: { run: Run }) {
  const r = run.result;
  const [rev, setRev] = useState({ verdict: "confirmed", note: "", component: r.image.component || "", location: r.image.location || "" }), [err, setErr] = useState<string | null>(null), [cur, setCur] = useState(r);
  return (
    <div className="space-y-4">
      <div className={`rounded-[10px] border px-3 py-2 text-sm ${cur.review ? "border-cond-normal/50 bg-cond-normal/10" : "border-cond-attention/50 bg-cond-attention/10"}`}>
        {cur.review ? <>Engineer review: <strong>{cur.review.verdict.replace("_", " ")}</strong> by {cur.review.reviewer} on {formatTimestamp(cur.review.reviewed_at)} — {cur.review.note}</> : <><strong>Model output — not verified.</strong> Detections are candidates and must be reviewed before being recorded as findings.</>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <figure className="m-0"><img src={`/api/v1/lab/vision/${run.id}/image`} alt={`Original inspection image ${r.image.filename}`} className="w-full rounded-[10px] border border-line" /><figcaption className="text-xs text-muted mt-1">Original · {r.image.filename} · SHA-256 {r.image.sha256.slice(0, 12)}…</figcaption></figure>
        <figure className="m-0"><img src={`data:image/png;base64,${r.overlay_png_base64}`} alt={`Candidate crack pixels highlighted in red; ${r.n_candidates} candidates`} className="w-full rounded-[10px] border border-line" /><figcaption className="text-xs text-muted mt-1">Candidate crack pixels (red) · {r.n_candidates} candidate(s) · area fraction {(r.crack_area_fraction * 100).toFixed(2)} %</figcaption></figure>
      </div>
      <DataTable rows={r.cracks.map((c: any) => ({ id: c.id, "length px": c.length_px, "length mm": c.length_mm ?? "—", "mean width px": c.mean_width_px, "mean width mm": c.mean_width_mm ?? "—", "orientation °": c.orientation_deg, contrast: c.contrast, confidence: c.confidence }))} />
      <KV items={[["Method", r.method], ["Parameters", JSON.stringify(r.params)], ["Component / location", `${r.image.component || "—"} · ${r.image.location || "—"}`]]} />
      <ul className="list-disc pl-5 text-sm">{r.notes.map((n: string) => <li key={n}>{n}</li>)}</ul>
      <div className="rounded-[12px] border border-line p-4 space-y-1">
        <h3 className="font-semibold">Engineer review</h3>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field label="Verdict"><select className="dr-field" value={rev.verdict} onChange={(e) => setRev({ ...rev, verdict: e.target.value })}><option value="confirmed">Confirmed</option><option value="partially_confirmed">Partially confirmed</option><option value="rejected">Rejected (false detection)</option></select></Field>
          <Field label="Structural component"><input className="dr-field" value={rev.component} onChange={(e) => setRev({ ...rev, component: e.target.value })} /></Field>
        </div>
        <Field label="Location (defect mapping)"><input className="dr-field" value={rev.location} onChange={(e) => setRev({ ...rev, location: e.target.value })} placeholder="e.g. block 4, downstream face, el. 585 m" /></Field>
        <Field label="Review note (required)"><textarea className="dr-field" rows={2} value={rev.note} onChange={(e) => setRev({ ...rev, note: e.target.value })} /></Field>
        <ErrorBox>{err}</ErrorBox>
        <button className={buttonClass("primary", "sm", "mt-2")} onClick={async () => { setErr(null); try { const x = await apiFetch<Run>(`/lab/analyses/${run.id}/review`, { json: { ...rev, confirmed_ids: rev.verdict === "rejected" ? [] : cur.cracks.map((c: any) => c.id) } }); setCur(x.result); } catch (e: any) { setErr(e.detail); } }}>Record review</button>
      </div>
      <ProvenanceBadge kind={cur.review ? "interpretation" : "model"} />
    </div>
  );
}
