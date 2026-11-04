"use client";
import Link from "next/link";
import { useState } from "react";
import { apiDownload, apiFetch } from "@dr/authentication";
import { ProvenanceBadge, buttonClass } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import type { Run } from "@/lib/types";
import { Plot, line, seriesTable } from "./Plot";
import { DataTable, KV, Panel, Warnings, fmt } from "./ui";
import { PublishToTwin } from "./PublishToTwin";
import { FragilityResult, HybridResult, ModalResult, VisionResult } from "./advancedResults";

const C = { obs: "#9B8461", pred: "#183C45", band: "rgba(114,190,177,0.25)", h: "#183C45", s: "#C0612B", t: "#5B7FA6", res: "#2C6B61", crit: "#B03A3A" };

function Assumptions({ items, title = "Assumptions" }: { items?: string[]; title?: string }) {
  if (!items?.length) return null;
  return <div><h3 className="font-semibold text-sm mb-1">{title}</h3><ul className="list-disc pl-5 text-sm space-y-0.5">{items.map((a) => <li key={a}>{a}</li>)}</ul></div>;
}

function MetricsTable({ rows }: { rows: { period: string; m: any }[] }) {
  return <DataTable rows={rows.filter((r) => r.m).map((r) => ({ period: r.period, n: r.m.n, MAE: r.m.MAE, RMSE: r.m.RMSE, R2: r.m.R2, bias: r.m.bias, "max |error|": r.m.max_abs_error, MAPE: r.m.MAPE_percent ?? "n/a" }))} />;
}

// ------------------------------------------------------------------ quality
export function QualityResult({ r }: { r: any }) {
  return (
    <div className="space-y-3">
      <KV items={[["Rows", r.rows], ["Duplicate rows", r.duplicate_rows], ["Duplicate timestamps", r.duplicate_timestamps ?? "—"], ["Unparseable timestamps", r.unparseable_timestamps ?? "—"],
        ["Median interval", r.sampling ? `${fmt(r.sampling.median_interval_s)} s` : "—"], ["Gaps > " + r.params.gap_factor + "× median", r.gaps?.length ?? "—"], ["Outlier method", `${r.params.outlier_method}${r.params.hampel_window ? ` (window ${r.params.hampel_window})` : ""}, |z| > ${r.params.mad_threshold}`]]} />
      <DataTable rows={r.columns.map((c: any) => ({ column: c.column, kind: c.kind, missing: c.missing, outliers: c.outliers ?? "—", min: c.min ?? "—", max: c.max ?? "—", mean: c.mean ?? "—" }))} />
      <Warnings items={r.warnings} />
    </div>
  );
}

// ------------------------------------------------------------------ signal
export function SignalResult({ r }: { r: any }) {
  const [show, setShow] = useState<Record<number, boolean>>({});
  const colors = ["#B9C2BE", C.obs, C.res, C.pred, "#5B7FA6", C.s];
  const traces = r.stages.map((s: any, i: number) => show[i] === false ? null : line(s.name, s.series, { line: { color: colors[i % colors.length], width: i === r.stages.length - 1 ? 2.4 : 1.4, dash: i === r.stages.length - 1 && i > 0 ? "dash" : "solid" } })).filter(Boolean);
  const sp = r.spectra;
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Signals shown" className="flex flex-wrap gap-2">
        {r.stages.map((s: any, i: number) => (
          <button key={i} type="button" aria-pressed={show[i] !== false} onClick={() => setShow({ ...show, [i]: show[i] === false })}
            className={`min-h-[36px] rounded-full border px-3 text-sm ${show[i] !== false ? "border-accent bg-surface font-semibold" : "border-line text-muted line-through"}`}>{s.name}</button>
        ))}
      </div>
      <Plot data={traces} ariaLabel={`Comparison of ${r.stages.length} processing stages for ${r.column}`} table={seriesTable(r.stages.map((s: any) => [s.name, s.series]))} />
      <DataTable rows={r.stages.map((s: any) => ({ stage: s.name, operation: s.op ?? "—", parameters: s.op ? JSON.stringify(s.params) : "—", mean: s.stats.mean, std: s.stats.std }))} />
      {sp?.original?.psd ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Plot height={260} ariaLabel="Welch power spectral density, original and processed" layout={{ yaxis: { type: "log", title: { text: "PSD" } }, xaxis: { title: { text: "Frequency (Hz)" } } }}
            data={[{ type: "scatter", mode: "lines", name: "Original", x: sp.original.psd.f, y: sp.original.psd.pxx, line: { color: "#B9C2BE" } }, { type: "scatter", mode: "lines", name: "Processed", x: sp.processed.psd.f, y: sp.processed.psd.pxx, line: { color: C.pred } }]} />
          <Plot height={260} ariaLabel="FFT amplitude spectrum of the processed signal" layout={{ xaxis: { title: { text: "Frequency (Hz)" } }, yaxis: { title: { text: "Amplitude" } } }}
            data={[{ type: "scatter", mode: "lines", name: "FFT amplitude (processed)", x: sp.processed.fft.f, y: sp.processed.fft.amplitude, line: { color: C.res } }]} />
        </div>
      ) : null}
      {sp?.original ? <p className="text-sm">Dominant frequency: original {fmt(sp.original.dominant_frequency_hz)} Hz · processed {fmt(sp.processed.dominant_frequency_hz)} Hz · sampling {fmt(r.fs_hz)} Hz (Welch: Hann window, {sp.original.psd.nperseg}-sample segments, 50 % overlap)</p> : null}
      {r.wavelet ? <Plot height={300} ariaLabel="Continuous wavelet transform magnitude" layout={{ yaxis: { type: "log", title: { text: "Frequency (Hz)" } }, xaxis: { title: { text: `Sample (×${r.wavelet.time_step_samples})` } } }}
        data={[{ type: "heatmap", z: r.wavelet.magnitude, y: r.wavelet.freqs_hz, colorscale: [[0, "#F5F4EF"], [0.5, "#72BEB1"], [1, "#10232D"]] }]} /> : null}
      {r.stl ? <Plot height={300} ariaLabel="STL decomposition: trend, seasonal and remainder" data={[line("Trend", r.stl.trend, { line: { color: C.pred } }), line("Seasonal", r.stl.seasonal, { line: { color: C.s } }), line("Remainder", r.stl.remainder, { line: { color: "#B9C2BE" } })]} /> : null}
      <Warnings items={r.warnings} />
    </div>
  );
}

// ------------------------------------------------------------------ statistics
export function StatsResult({ kind, r }: { kind: string; r: any }) {
  if (kind === "descriptive") return <DataTable rows={r.table} />;
  if (kind === "correlation")
    return (
      <div className="space-y-3">
        <Plot height={Math.max(300, 60 * r.columns.length)} ariaLabel="Correlation matrix heatmap" layout={{ yaxis: { autorange: "reversed" }, margin: { l: 140, b: 120 } }}
          data={[{ type: "heatmap", z: r.matrix, x: r.columns, y: r.columns, zmin: -1, zmax: 1, colorscale: [[0, "#C0612B"], [0.5, "#F5F4EF"], [1, "#183C45"]], text: r.matrix.map((row: number[]) => row.map((v) => v?.toFixed(2))), texttemplate: "%{text}" }]} />
        <p className="text-sm text-muted">{r.method}. {r.note}</p>
      </div>
    );
  if (kind === "regression") {
    const s = r.series;
    return (
      <div className="space-y-4">
        <div className="dr-equation">{r.formula}</div>
        <KV items={[["n", r.n], ["R²", fmt(r.fit.R2)], ["adjusted R²", fmt(r.fit.adj_R2)], ["σ residual", fmt(r.fit.sigma)], ["F (p)", `${fmt(r.fit.F)} (${fmt(r.fit.F_p_value)})`], ["AIC", fmt(r.fit.AIC)]]} />
        <DataTable rows={r.coefficients} columns={["term", "estimate", "std_error", "ci_low", "ci_high", "p_value"]} labels={{ ci_low: "CI low", ci_high: "CI high", std_error: "std. error" }} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Plot ariaLabel="Scatter of response against first explanatory variable" layout={{ xaxis: { title: { text: r.scatter.x_name } } }} data={[{ type: "scatter", mode: "markers", name: "observations", x: r.scatter.x, y: r.scatter.y, marker: { color: C.obs, size: 5, opacity: 0.7 } }]} />
          <Plot ariaLabel="Observed, fitted and prediction interval" data={[line("PI high", s.pi_high, { line: { width: 0 }, showlegend: false }), line("95 % prediction interval", s.pi_low, { fill: "tonexty", fillcolor: C.band, line: { width: 0 } }), line("Observed", s.observed, { line: { color: C.obs } }), line("Fitted", s.fitted, { line: { color: C.pred, width: 2 } })].filter(Boolean)} table={seriesTable([["observed", s.observed], ["fitted", s.fitted]])} />
        </div>
        <Plot height={240} ariaLabel="Residuals" data={[line("Residual", s.residuals, { line: { color: C.res } })]} />
        <h3 className="font-semibold text-sm">Diagnostics</h3>
        <KV items={[["Durbin–Watson", fmt(r.diagnostics.durbin_watson)], ["Breusch–Pagan p", fmt(r.diagnostics.breusch_pagan.p_value)], ["Jarque–Bera p", fmt(r.diagnostics.jarque_bera.p_value)], ["max Cook's D", fmt(r.diagnostics.max_cooks_distance)], ["VIF", r.diagnostics.vif.map((v: any) => `${v.term}: ${fmt(v.VIF, 3)}`).join(", ") || "—"]]} />
        <Assumptions items={r.assumptions} />
        <Warnings items={[...r.warnings, r.note]} />
      </div>
    );
  }
  if (kind === "pca")
    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Plot height={280} ariaLabel="Scree plot of explained variance" layout={{ yaxis: { title: { text: "Explained variance ratio" }, range: [0, 1] } }}
            data={[{ type: "bar", name: "per component", x: r.loadings.map((l: any) => l.component), y: r.explained_variance_ratio, marker: { color: C.pred } }, { type: "scatter", mode: "lines+markers", name: "cumulative", x: r.loadings.map((l: any) => l.component), y: r.cumulative, line: { color: C.obs } }]} />
          <Plot height={280} ariaLabel="Principal component scores over time" data={Object.entries(r.scores).map(([k, s]: any, i) => line(k, s, { line: { color: [C.pred, C.obs, C.res][i] } }))} />
        </div>
        <DataTable rows={r.loadings} />
        <p className="text-sm text-muted">{r.method}; n = {r.n}; {r.standardized ? "standardised variables" : "centred variables"}. {r.kaiser_retain !== null ? `Kaiser criterion (eigenvalue > 1) suggests ${r.kaiser_retain} component(s).` : ""} {r.note}</p>
      </div>
    );
  if (kind === "timeseries")
    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {["acf", "pacf"].map((k) => (
            <Plot key={k} height={260} ariaLabel={`${k.toUpperCase()} with 95 % confidence band`} layout={{ yaxis: { range: [-1, 1] }, xaxis: { title: { text: "Lag" } } }}
              data={[{ type: "bar", name: k.toUpperCase(), y: r[k], marker: { color: C.pred } }, { type: "scatter", mode: "lines", name: "95 % band", y: r[`${k}_ci`].map((c: number[], i: number) => c[1] - r[k][i]), line: { color: C.obs, dash: "dot" } }, { type: "scatter", mode: "lines", showlegend: false, y: r[`${k}_ci`].map((c: number[], i: number) => c[0] - r[k][i]), line: { color: C.obs, dash: "dot" } }]} />
          ))}
        </div>
        <KV items={[["ADF statistic", fmt(r.adf.statistic)], ["ADF p-value", fmt(r.adf.p_value)], ["Interpretation", r.adf.interpretation], [`Ljung–Box Q (lag ${r.ljung_box.lag})`, `${fmt(r.ljung_box.Q)} (p ${fmt(r.ljung_box.p_value)})`]]} />
      </div>
    );
  if (kind === "hypothesis") return <div className="space-y-2"><KV items={[["Test", r.method], ["Hypothesis", r.hypothesis], ["Statistic", fmt(r.statistic)], ["p-value", fmt(r.p_value)]]} /><Warnings items={[r.note]} /></div>;
  if (kind === "factor") return <div className="space-y-2"><DataTable rows={r.loadings} /><p className="text-sm text-muted">{r.method}. {r.note}</p></div>;
  return <pre className="text-xs">{JSON.stringify(r, null, 2)}</pre>;
}

// ------------------------------------------------------------------ HST
export function HstResult({ r }: { r: any }) {
  const s = r.series;
  const calEnd = r.periods.calibration[1];
  const shape = { type: "line", x0: calEnd, x1: calEnd, yref: "paper", y0: 0, y1: 1, line: { color: C.obs, dash: "dot" } };
  const ann = [{ x: calEnd, yref: "paper", y: 1.02, text: "calibration | validation", showarrow: false, font: { size: 10, color: "#6E5A3A" } }];
  const v = r.metrics.validation;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Validation RMSE", v ? `${fmt(v.RMSE)} ${r.unit}` : "—", v ? `n = ${v.n}, independent of fit` : "no validation period"], ["Validation MAE", v ? `${fmt(v.MAE)} ${r.unit}` : "—", "mean absolute error"],
          ["Calibration RMSE", `${fmt(r.metrics.calibration.RMSE)} ${r.unit}`, "goodness of fit only"],
          ["Interval coverage", r.prediction_interval_coverage_validation !== null ? `${(r.prediction_interval_coverage_validation * 100).toFixed(1)} %` : "—", `validation; nominal ${((1 - r.params.alpha) * 100).toFixed(0)} %`]].map(([k, val, hint]) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-3 min-w-0"><div className="text-xs text-muted">{k}</div><div className="font-mono text-lg truncate">{val}</div><div className="text-xs text-muted">{hint}</div></div>
        ))}
      </div>
      <div><h3 className="font-semibold text-sm mb-1">Model formulation · {r.variant}</h3><div className="dr-equation">{r.formula}</div>
        <ul className="mt-2 text-xs text-muted space-y-0.5">{Object.entries(r.definitions).filter(([, d]) => d).map(([k, d]) => <li key={k}><span className="font-mono">{k}</span> = {String(d)}</li>)}</ul></div>
      <Plot ariaLabel="Observed versus HST prediction with prediction interval; dotted line separates calibration and validation" layout={{ shapes: [shape], annotations: ann }}
        data={[line("PI high", s.pi_high, { line: { width: 0 }, showlegend: false }), line(`${((1 - r.params.alpha) * 100).toFixed(0)} % prediction interval`, s.pi_low, { fill: "tonexty", fillcolor: C.band, line: { width: 0 } }),
          line("Observed", s.observed, { line: { color: C.obs, width: 1.3 } }), line("HST prediction", s.predicted, { line: { color: C.pred, width: 2 } })].filter(Boolean)}
        table={seriesTable([["observed", s.observed], ["predicted", s.predicted], ["pi_low", s.pi_low], ["pi_high", s.pi_high]])} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Plot height={280} ariaLabel="Individual HST components: hydrostatic, seasonal and time" data={[line("Hydrostatic", s.hydrostatic, { line: { color: C.h } }), line(r.variant.startsWith("HTT") ? "Thermal" : "Seasonal", s.seasonal, { line: { color: C.s } }), line("Time", s.time, { line: { color: C.t } })]} layout={{ shapes: [shape] }} />
        <Plot height={280} ariaLabel="Standardised residuals over time with screening thresholds" layout={{ shapes: [shape, ...[1, -1].map((k) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: k * r.params.residual_threshold, y1: k * r.params.residual_threshold, line: { color: C.crit, dash: "dash" } }))] }}
          data={[line("Standardised residual", s.std_residual, { line: { color: C.res } })]} />
      </div>
      <MetricsTable rows={[{ period: `Calibration (${r.periods.n_calibration})`, m: r.metrics.calibration }, { period: `Validation (${r.periods.n_validation})`, m: r.metrics.validation }]} />
      <p className="text-sm text-muted">{r.metrics.validation_note} Calibration {formatTimestamp(r.periods.calibration[0])} → {formatTimestamp(r.periods.calibration[1])}{r.periods.validation ? `; validation ${formatTimestamp(r.periods.validation[0])} → ${formatTimestamp(r.periods.validation[1])}` : ""}.</p>
      <DataTable rows={r.coefficients} columns={["term", "group", "estimate", "std_error", "ci_low", "ci_high", "p_value"]} labels={{ std_error: "std. error", ci_low: "CI low", ci_high: "CI high" }} />
      <KV items={[["R² (calibration)", fmt(r.calibration_stats.R2)], ["σ residual (calibration)", `${fmt(r.calibration_stats.sigma_residual)} ${r.unit}`], ["Durbin–Watson", fmt(r.calibration_stats.durbin_watson)], ["Condition number", fmt(r.calibration_stats.condition_number)], ["Residual exceedances", `${r.residual_exceedances.count} (|z| ≥ ${r.residual_exceedances.threshold})`]]} />
      <p className="text-sm">{r.residual_exceedances.note}</p>
      <Assumptions items={r.assumptions} />
      <Warnings items={r.warnings} />
    </div>
  );
}

// ------------------------------------------------------------------ ML
export function MlResult({ r }: { r: any }) {
  const done = r.results.filter((x: any) => x.status === "completed");
  const [sel, setSel] = useState<string>(r.ranking[0]?.model ?? "");
  const [sortKey, setSortKey] = useState<"RMSE" | "MAE" | "R2">("RMSE");
  const m = done.find((x: any) => x.model === sel) ?? done[0];
  const rows = [...done].sort((a: any, b: any) => sortKey === "R2" ? (b.validation.R2 ?? -1e9) - (a.validation.R2 ?? -1e9) : a.validation[sortKey] - b.validation[sortKey]);
  return (
    <div className="space-y-5">
      <p className="text-sm">Validation: <strong>{r.validation.scheme.replace("_", "-")}</strong> ({r.validation.n_splits} split{r.validation.n_splits > 1 ? "s" : ""}), n = {r.n}. Inputs: <span className="font-mono">{r.inputs.join(", ")}</span>. Intervals: {r.interval.method}, nominal {(r.interval.nominal_coverage * 100).toFixed(0)} %.</p>
      <div className="dr-table-wrap">
        <table className="dr-table">
          <thead><tr><th>Model</th>{(["MAE", "RMSE", "R2"] as const).map((k) => <th key={k}><button className="font-semibold" onClick={() => setSortKey(k)} aria-pressed={sortKey === k}>Val {k === "R2" ? "R²" : k}{sortKey === k ? " ▾" : ""}</button></th>)}<th>MAPE</th><th>PI coverage</th><th className="border-l border-line">Calib. RMSE</th><th>Fit time</th></tr></thead>
          <tbody>
            {rows.map((x: any) => (
              <tr key={x.model} className={x.model === m?.model ? "bg-sage/60" : ""}>
                <td><button className="font-semibold text-accent-ink underline" onClick={() => setSel(x.model)} aria-pressed={x.model === m?.model}>{x.label}</button>{r.ranking[0]?.model === x.model ? <span className="ml-2 text-xs text-bronze-ink">best (val RMSE)</span> : null}</td>
                <td className="font-mono">{fmt(x.validation.MAE)}</td><td className="font-mono">{fmt(x.validation.RMSE)}</td><td className="font-mono">{fmt(x.validation.R2)}</td>
                <td className="text-muted" title={x.validation.MAPE_note}>{x.validation.MAPE_percent !== undefined ? fmt(x.validation.MAPE_percent) + " %" : "n/a"}</td>
                <td className="font-mono">{(x.validation.interval_coverage * 100).toFixed(1)} %</td>
                <td className="font-mono text-muted border-l border-line">{fmt(x.calibration_last_fold?.RMSE)}</td><td className="font-mono text-muted">{x.fit_time_s.toFixed(2)} s</td>
              </tr>
            ))}
            {r.results.filter((x: any) => x.status !== "completed").map((x: any) => <tr key={x.model} className="text-muted"><td>{x.model.toUpperCase()}</td><td colSpan={7}>{x.note}</td></tr>)}
          </tbody>
        </table>
      </div>
      {m ? (
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Plot ariaLabel={`Observed and ${m.label} predictions with conformal prediction interval in validation periods`}
            data={[line("Observed", r.observed, { line: { color: C.obs, width: 1.2 } }), line("PI high", m.series.pi_high, { line: { width: 0 }, showlegend: false, mode: "lines" }),
              line("Prediction interval", m.series.pi_low, { fill: "tonexty", fillcolor: C.band, line: { width: 0 } }), line(`${m.label} (validation)`, m.series.predicted, { line: { color: C.pred, width: 2 } })].filter(Boolean)}
            table={seriesTable([["predicted", m.series.predicted], ["pi_low", m.series.pi_low], ["pi_high", m.series.pi_high]])} />
          <div className="space-y-3">
            {m.permutation_importance ? <Plot height={90 + 30 * m.permutation_importance.length} ariaLabel="Permutation importance of inputs on validation data" layout={{ margin: { l: 150, t: 10 }, xaxis: { title: { text: "Increase in validation RMSE when permuted" } }, yaxis: { automargin: true, dtick: 1 }, showlegend: false }}
              data={[{ type: "bar", orientation: "h", x: m.permutation_importance.map((p: any) => p.importance).reverse(), y: m.permutation_importance.map((p: any) => p.feature).reverse(), marker: { color: C.res }, error_x: { type: "data", array: m.permutation_importance.map((p: any) => p.std).reverse() } }]} /> : null}
            <div><h3 className="font-semibold text-sm mb-1">Configuration</h3><pre className="dr-equation text-xs whitespace-pre-wrap">{JSON.stringify(m.params, null, 1)}</pre></div>
          </div>
        </div>
      ) : null}
      {m ? <DataTable rows={m.folds.map((f: any) => ({ fold: f.fold, calibration: `${formatTimestamp(f.calibration_period[0])} → ${formatTimestamp(f.calibration_period[1])}`, validation: `${formatTimestamp(f.validation_period[0])} → ${formatTimestamp(f.validation_period[1])}`, RMSE: f.RMSE, MAE: f.MAE, coverage: f.interval_coverage }))} /> : null}
      <div className="text-sm"><h3 className="font-semibold">Leakage controls</h3><ul className="list-disc pl-5">{r.validation.leakage_controls.map((l: string) => <li key={l}>{l}</li>)}</ul></div>
      <Warnings items={r.warnings} />
    </div>
  );
}

// ------------------------------------------------------------------ anomaly
export function AnomalyResult({ kind, r }: { kind: string; r: any }) {
  let plot = null;
  if (kind === "anomaly_zscore") plot = <Plot ariaLabel="Standardised values with flagged samples" data={[line("z", r.series.z, { line: { color: C.res } })]} layout={{ shapes: [1, -1].map((k) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: k * r.params.threshold, y1: k * r.params.threshold, line: { color: C.crit, dash: "dash" } })) }} />;
  if (kind === "anomaly_cusum") plot = <Plot ariaLabel="CUSUM statistics with decision interval" data={[line("S+", r.series.S_plus, { line: { color: C.pred } }), line("S−", r.series.S_minus, { line: { color: C.s } })]} layout={{ shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: r.params.h_sigma, y1: r.params.h_sigma, line: { color: C.crit, dash: "dash" } }] }} />;
  if (kind === "anomaly_changepoint") plot = <Plot ariaLabel="Series with detected change points" data={[line("value", r.series, { line: { color: C.obs } }), ...r.segments.map((s: any, i: number) => ({ type: "scatter", mode: "lines", name: i === 0 ? "segment mean" : undefined, showlegend: i === 0, x: [s.start, s.end], y: [s.mean, s.mean], line: { color: C.pred, width: 3 } }))]} layout={{ shapes: r.change_points.map((c: string) => ({ type: "line", x0: c, x1: c, yref: "paper", y0: 0, y1: 1, line: { color: C.crit, dash: "dot" } })) }} />;
  if (kind === "anomaly_multivariate") plot = <Plot ariaLabel="Multivariate novelty score" data={[line("score", r.series.score, { line: { color: C.res } })]} layout={r.params.threshold_D2 ? { shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: r.params.threshold_D2, y1: r.params.threshold_D2, line: { color: C.crit, dash: "dash" } }] } : {}} />;
  return (
    <div className="space-y-4">
      {plot}
      <KV items={[["Method", r.method], ["Parameters", JSON.stringify(r.params)], ["Flags / alarms", r.n_flags ?? r.n_alarm_samples ?? r.change_points?.length], ...(r.first_alarm !== undefined ? [["First alarm", r.first_alarm ? formatTimestamp(r.first_alarm) : "none"] as [string, string]] : [])]} />
      {r.segments ? <DataTable rows={r.segments.map((s: any) => ({ start: formatTimestamp(s.start), end: formatTimestamp(s.end), mean: s.mean, n: s.n }))} /> : null}
      {r.flags?.length ? <DataTable rows={r.flags.slice(0, 50).map((f: any) => ({ time: formatTimestamp(f.time), value: f.value, score: f.score }))} /> : null}
      <Warnings items={[r.note]} />
    </div>
  );
}

// ------------------------------------------------------------------ DHI
export function DhiResult({ r }: { r: any }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-6"><div><div className="text-xs text-muted">Dam Health Index ({r.aggregation})</div><div className="font-mono text-4xl">{fmt(r.index, 3)}</div></div><div><div className="text-xs text-muted">Classification</div><div className="font-semibold">{r.classification}</div></div><ProvenanceBadge kind="model" /></div>
      <Plot height={260} ariaLabel="Indicator contributions to the index" layout={{ margin: { l: 160 } }}
        data={[{ type: "bar", orientation: "h", name: "normalised value", y: r.indicators.map((i: any) => i.name), x: r.indicators.map((i: any) => i.normalised), marker: { color: "#C6D9D1" } }, { type: "bar", orientation: "h", name: "weighted contribution", y: r.indicators.map((i: any) => i.name), x: r.indicators.map((i: any) => i.contribution), marker: { color: C.pred } }]} />
      <DataTable rows={r.indicators.map((i: any) => ({ indicator: i.name, value: i.current_value, "ref good": i.ref_good, "ref poor": i.ref_poor, normalised: i.normalised, weight: i.weight, contribution: i.contribution, justification: i.justification ?? "" }))} />
      {r.ahp ? <KV items={[["AHP λmax", fmt(r.ahp.lambda_max)], ["Consistency ratio", `${fmt(r.ahp.CR, 3)} ${r.ahp.consistent ? "(acceptable, < 0.10)" : "(inconsistent — revise judgements)"}`]]} /> : null}
      <KV items={[["Weight source", r.weight_source], ["Justification", r.weight_justification]]} />
      <h3 className="font-semibold text-sm">Sensitivity (±20 % on each weight)</h3>
      <DataTable rows={r.sensitivity.map((s: any) => ({ indicator: s.indicator, "index low": s.index_low, "index high": s.index_high, range: s.range, "class changes": s.class_changes }))} />
      {r.history ? <Plot height={260} ariaLabel="Index history over time" data={[{ type: "scatter", mode: "lines", name: "DHI", x: r.history.x, y: r.history.y, line: { color: C.pred } }]} layout={{ yaxis: { range: [0, 1] } }} /> : null}
      {r.history?.periods ? <DataTable rows={r.history.periods} /> : null}
      <p className="text-sm"><strong>Interpretation:</strong> {r.interpretation}</p>
      <Assumptions title="Limitations" items={r.limitations} />
    </div>
  );
}

export function RunResult({ run }: { run: Run }) {
  const r = run.result;
  if (run.status === "failed") return <p className="text-cond-critical">{run.error}</p>;
  if (!r) return null;
  if (run.kind === "quality") return <QualityResult r={r} />;
  if (run.kind === "signal") return <SignalResult r={r} />;
  if (run.kind === "hst") return <HstResult r={r} />;
  if (run.kind === "ml") return <MlResult r={r} />;
  if (run.kind === "dhi") return <DhiResult r={r} />;
  if (run.kind === "hybrid") return <HybridResult r={r} />;
  if (run.kind === "fragility") return <FragilityResult r={r} />;
  if (run.kind === "modal") return <ModalResult r={r} />;
  if (run.kind === "crack_detection") return <VisionResult run={run} />;
  if (run.kind.startsWith("anomaly")) return <AnomalyResult kind={run.kind} r={r} />;
  return <StatsResult kind={run.kind} r={r} />;
}

export function RunPanel({ run, onDeleted }: { run: Run; onDeleted?: () => void }) {
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;
  return (
    <Panel title={run.title} actions={
      <div className="flex flex-wrap gap-2">
        {run.result?.data_provenance ? <ProvenanceBadge kind={run.result.data_provenance === "historical" ? "historical" : run.result.data_provenance} /> : null}
        <a href={`/api/v1/lab/analyses/${run.id}/report`} target="_blank" rel="noopener" className={buttonClass("secondary", "sm")}>Report (HTML/PDF)</a>
        <button className={buttonClass("secondary", "sm")} onClick={() => apiDownload(`/lab/analyses/${run.id}/export.csv`, `analysis-${run.id.slice(0, 8)}.csv`).catch(() => alert("This analysis has no series to export."))}>Export CSV</button>
        <Link href={`/runs/${run.id}`} className={buttonClass("ghost", "sm")}>Permalink</Link>
        {onDeleted ? <button className={buttonClass("ghost", "sm", "text-cond-critical")} onClick={async () => { if (confirm("Delete this saved analysis?")) { await apiFetch(`/lab/analyses/${run.id}`, { method: "DELETE" }); setDeleted(true); onDeleted(); } }}>Delete</button> : null}
      </div>}>
      <p className="mb-4 text-xs text-muted">Run {run.id.slice(0, 8)} · {formatTimestamp(run.created_at)} · engine v{run.engine_version} · {run.duration_ms.toFixed(0)} ms · parameters stored for reproducibility</p>
      <RunResult run={run} />
      {run.kind === "hst" && run.status === "completed" ? <div className="mt-4"><PublishToTwin runId={run.id} unit={run.result?.unit ?? ""} /></div> : null}
    </Panel>
  );
}
