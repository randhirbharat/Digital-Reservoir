"use client";
import { useMemo, useState } from "react";
import { LineChart, Toggle, DemoTag } from "./Chart";

/** Synthetic HST decomposition — the series is generated here and labelled as synthetic. */
function makeSeries(n = 140) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2.2;
    const level = 0.8 * Math.sin(2 * Math.PI * (t - 0.15)) + 0.2 * Math.sin(Math.PI * t);
    const H = 2.1 * level + 0.5 * level * level;
    const S = -1.1 * Math.cos(2 * Math.PI * t);
    const T = 0.55 * Math.log(1 + 3 * t) - 0.6;
    const noise = 0.28 * Math.sin(i * 1.7) + 0.18 * Math.cos(i * 3.1);
    out.push({ H, S, T, obs: H + S + T + noise });
  }
  return out;
}

export function HstDemo() {
  const data = useMemo(() => makeSeries(), []);
  const [h, setH] = useState(true), [s, setS] = useState(true), [t, setT] = useState(true);
  const fit = data.map((p) => (h ? p.H : 0) + (s ? p.S : 0) + (t ? p.T : 0));
  const rmse = Math.sqrt(data.reduce((a, p, i) => a + (p.obs - fit[i]) ** 2, 0) / data.length);
  const eq = `δ = a₀${h ? " + a₁h + a₂h²" : ""}${s ? " + b₁sin(s) + b₂cos(s)" : ""}${t ? " + c₁ln(1+t)" : ""} + ε`;
  return (
    <div className="grid gap-8 lg:grid-cols-2 items-start grid-cols-1 min-w-0">
      <div className="space-y-4">
        <div role="group" aria-label="Components included" className="flex flex-wrap gap-2">
          <Toggle pressed={h} onClick={() => setH(!h)}>Hydrostatic</Toggle>
          <Toggle pressed={s} onClick={() => setS(!s)}>Seasonal</Toggle>
          <Toggle pressed={t} onClick={() => setT(!t)}>Time / irreversible</Toggle>
        </div>
        <div className="dr-equation" tabIndex={0}>{eq}</div>
        <p className="text-sm text-muted">Remove a component and the unexplained part appears in the error — this is how HST helps separate load effects from changes that need attention.</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap"><span className="font-semibold text-sm">Crest displacement (mm)</span><DemoTag /></div>
        <LineChart ariaLabel="Synthetic observed displacement and the sum of selected HST components"
          xLabels={["2024", "2026"]}
          series={[
            { label: "Observed (synthetic)", values: data.map((d) => d.obs), color: "#9B8461", width: 1.4 },
            { label: "Selected components", values: fit, color: "var(--dr-accent)", width: 2.6 },
          ]} />
        <div className="font-mono text-sm">RMSE = {rmse.toFixed(2)} mm</div>
      </div>
    </div>
  );
}
