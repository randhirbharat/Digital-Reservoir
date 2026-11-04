"use client";
import { useState } from "react";
import { LineChart, Slider, DemoTag } from "./Chart";

/** Standard normal CDF via the Abramowitz–Stegun erf approximation (|error| < 1.5e-7). */
export function phi(z: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export function FragilityDemo() {
  const [theta, setTheta] = useState(0.6), [beta, setBeta] = useState(0.45);
  const xs = Array.from({ length: 120 }, (_, i) => 0.01 + (i / 119) * 2);
  const p = xs.map((x) => phi(Math.log(x / theta) / beta));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap"><span className="font-semibold text-sm">Lognormal fragility function</span><DemoTag>Assumed parameters — illustration only</DemoTag></div>
      <div className="grid sm:grid-cols-2 gap-4 grid-cols-1 min-w-0">
        <Slider label="Median θ (PGA, g)" value={theta} min={0.1} max={1.5} step={0.05} onChange={setTheta} format={(v) => v.toFixed(2)} />
        <Slider label="Dispersion β" value={beta} min={0.15} max={0.9} step={0.05} onChange={setBeta} format={(v) => v.toFixed(2)} />
      </div>
      <LineChart ariaLabel="Probability of exceeding a damage state versus peak ground acceleration" yDomain={[0, 1]} xLabels={["0 g", "2 g"]}
        series={[{ label: "P(DS ≥ ds | PGA)", values: p, color: "var(--dr-accent)", width: 2.6 }]} />
      <p className="text-sm text-muted">These parameters are not an assessment of any structure. In the Lab, θ and β are estimated from analysis results by maximum likelihood, with bootstrap confidence bands.</p>
    </div>
  );
}
