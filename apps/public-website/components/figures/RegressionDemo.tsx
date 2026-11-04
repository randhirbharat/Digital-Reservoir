"use client";
import { useMemo, useState } from "react";
import { Slider, DemoTag } from "./Chart";

function rng(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

export function RegressionDemo() {
  const [noise, setNoise] = useState(0.6);
  const pts = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 60 }, () => {
      const x = r() * 10;
      const g = Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
      return { x, y: 1.2 + 0.45 * x + noise * g };
    });
  }, [noise]);
  const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0), sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const b1 = sxy / sxx, b0 = my - b1 * mx;
  const sse = pts.reduce((a, p) => a + (p.y - b0 - b1 * p.x) ** 2, 0), sst = pts.reduce((a, p) => a + (p.y - my) ** 2, 0);
  const r2 = 1 - sse / sst, s = Math.sqrt(sse / (n - 2)), seb1 = s / Math.sqrt(sxx);
  const X = (x: number) => 40 + x * 58, Y = (y: number) => 220 - (y + 1) * 26;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap"><span className="font-semibold text-sm">Ordinary least squares on synthetic data</span><DemoTag /></div>
      <Slider label="Noise standard deviation" value={noise} min={0.1} max={2} step={0.1} onChange={setNoise} />
      <svg viewBox="0 0 640 240" width="100%" role="img" aria-label="Scatter plot with fitted regression line" className="rounded-xl border border-line bg-bg">
        {pts.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={3.2} fill="#9B8461" fillOpacity={0.75} />)}
        <line x1={X(0)} y1={Y(b0)} x2={X(10)} y2={Y(b0 + 10 * b1)} stroke="var(--dr-accent)" strokeWidth={2.5} />
      </svg>
      <div className="font-mono text-sm grid sm:grid-cols-3 gap-2 grid-cols-1 min-w-0">
        <span>ŷ = {b0.toFixed(2)} + {b1.toFixed(3)}·x</span><span>R² = {r2.toFixed(3)}</span><span>95% CI slope ± {(1.96 * seb1).toFixed(3)}</span>
      </div>
    </div>
  );
}
