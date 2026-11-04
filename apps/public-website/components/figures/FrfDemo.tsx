"use client";
import { useState } from "react";
import { LineChart, Slider, DemoTag } from "./Chart";

export function FrfDemo() {
  const [zeta, setZeta] = useState(0.05);
  const fn = 3.2;
  const fs = Array.from({ length: 300 }, (_, i) => 0.5 + (i / 299) * 6);
  const H = fs.map((f) => { const r = f / fn; return 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2); });
  const peak = Math.max(...H), half = peak / Math.SQRT2;
  const above = fs.filter((_, i) => H[i] >= half);
  const est = above.length > 1 ? (above[above.length - 1] - above[0]) / (2 * fn) : NaN;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap"><span className="font-semibold text-sm">Single-degree-of-freedom frequency response (fₙ = 3.2 Hz)</span><DemoTag /></div>
      <Slider label="Damping ratio ζ" value={zeta} min={0.01} max={0.2} step={0.01} onChange={setZeta} format={(v) => `${(v * 100).toFixed(0)} %`} />
      <LineChart ariaLabel="Dynamic amplification versus frequency" xLabels={["0.5 Hz", "6.5 Hz"]}
        markers={[{ y: half, color: "#9B8461", label: "half-power" }]}
        series={[{ label: "|H(f)| (normalised)", values: H, color: "var(--dr-accent)", width: 2.4 }]} />
      <div className="font-mono text-sm">half-power estimate ζ ≈ {Number.isFinite(est) ? (est * 100).toFixed(1) : "—"} %  (true {(zeta * 100).toFixed(0)} %, grid resolution limits accuracy)</div>
    </div>
  );
}
