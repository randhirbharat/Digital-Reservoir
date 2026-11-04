"use client";
import { useState } from "react";
import { AnalysisLayout, useRunner } from "@/components/AnalysisLayout";
import { CheckList, Field, Input, Select } from "@/components/ui";
import { useApi } from "@/lib/useApi";

export default function MlPage() {
  const runner = useRunner();
  const { data: cat } = useApi<any>("/lab/analyses/catalogue");
  const lib = cat?.ml_library;
  const [p, setP] = useState({ target: "", features: [] as string[], models: ["linear", "ridge", "random_forest", "gradient_boosting"], scheme: "holdout", calibration_fraction: 0.8, n_folds: 5, test_fraction: 0.2, seasonal_features: true, trend_feature: true, lag_col: "", lags: "", interval_alpha: 0.1 });
  const [params, setParams] = useState<Record<string, string>>({});
  return (
    <AnalysisLayout title="AI / ML laboratory" runner={runner} submitLabel="Train and compare"
      lead="Every model is trained and validated on identical chronological splits; preprocessing is fitted inside each calibration window to prevent leakage. Ranking uses validation error only."
      canSubmit={(d) => !!(d.versionId && p.target && p.models.length && (p.features.length || p.seasonal_features || p.trend_feature))}
      onSubmit={(d) => {
        const models = p.models.map((m) => { let prm = {}; try { prm = params[m] ? JSON.parse(params[m]) : {}; } catch { /* keep defaults */ } return { model: m, params: prm }; });
        const lags = p.lag_col && p.lags ? { [p.lag_col]: p.lags.split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => x > 0) } : undefined;
        runner.exec("ml", { dataset_version_id: d.versionId, params: { time_col: d.dataset?.time_column, target: p.target, features: p.features, models, scheme: p.scheme, calibration_fraction: p.calibration_fraction, n_folds: p.n_folds, test_fraction: p.test_fraction, seasonal_features: p.seasonal_features, trend_feature: p.trend_feature, lags, interval_alpha: p.interval_alpha } });
      }}
      form={(d) => (
        <>
          <Field label="Target"><Select value={p.target} onChange={(e) => setP({ ...p, target: e.target.value, features: p.features.filter((f) => f !== e.target.value) })} options={d.numeric.map((c) => ({ value: c, label: c }))} placeholder="— select —" /></Field>
          <CheckList label="Input variables" options={d.numeric.filter((c) => c !== p.target)} value={p.features} onChange={(v) => setP({ ...p, features: v })} />
          <label className="flex items-center gap-2 text-sm min-h-[32px]"><input type="checkbox" className="size-4" checked={p.seasonal_features} onChange={(e) => setP({ ...p, seasonal_features: e.target.checked })} />Add seasonal features (sin/cos day of year)</label>
          <label className="flex items-center gap-2 text-sm min-h-[32px]"><input type="checkbox" className="size-4" checked={p.trend_feature} onChange={(e) => setP({ ...p, trend_feature: e.target.checked })} />Add time-trend feature</label>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Lagged variable"><Select value={p.lag_col} onChange={(e) => setP({ ...p, lag_col: e.target.value })} options={d.numeric.map((c) => ({ value: c, label: c }))} placeholder="— none —" /></Field>
            <Field label="Lags (samples)"><Input placeholder="e.g. 1,7,30" value={p.lags} onChange={(e) => setP({ ...p, lags: e.target.value })} /></Field>
          </div>
          <fieldset className="pt-2"><legend className="dr-label">Models</legend>
            {lib ? Object.entries(lib.available).map(([k, m]: any) => (
              <div key={k} className="py-1">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={p.models.includes(k)} onChange={(e) => setP({ ...p, models: e.target.checked ? [...p.models, k] : p.models.filter((x) => x !== k) })} />{m.label} <span className="text-xs text-muted">({m.family})</span></label>
                {p.models.includes(k) && Object.keys(m.default_params).length ? <Input className="mt-1 font-mono text-xs" aria-label={`${m.label} parameters (JSON)`} placeholder={JSON.stringify(m.default_params)} value={params[k] ?? ""} onChange={(e) => setParams({ ...params, [k]: e.target.value })} /> : null}
              </div>
            )) : null}
            {lib ? <p className="text-xs text-muted mt-1">Pending (Stage 6): {Object.values(lib.pending).join(" ")}</p> : null}
          </fieldset>
          <Field label="Validation scheme"><Select value={p.scheme} onChange={(e) => setP({ ...p, scheme: e.target.value })} options={[{ value: "holdout", label: "Chronological holdout" }, { value: "rolling_origin", label: "Rolling-origin (expanding window)" }, { value: "frozen_test", label: "Frozen test period" }]} /></Field>
          {p.scheme === "holdout" ? <Field label="Calibration fraction"><Input type="number" min={0.5} max={0.95} step={0.05} value={p.calibration_fraction} onChange={(e) => setP({ ...p, calibration_fraction: Number(e.target.value) })} /></Field> : null}
          {p.scheme === "rolling_origin" ? <Field label="Folds"><Input type="number" min={2} max={10} value={p.n_folds} onChange={(e) => setP({ ...p, n_folds: Number(e.target.value) })} /></Field> : null}
          {p.scheme === "frozen_test" ? <Field label="Frozen test fraction"><Input type="number" min={0.05} max={0.5} step={0.05} value={p.test_fraction} onChange={(e) => setP({ ...p, test_fraction: Number(e.target.value) })} /></Field> : null}
          <Field label="Prediction interval α (split-conformal)"><Input type="number" min={0.01} max={0.5} step={0.01} value={p.interval_alpha} onChange={(e) => setP({ ...p, interval_alpha: Number(e.target.value) })} /></Field>
        </>
      )} />
  );
}
