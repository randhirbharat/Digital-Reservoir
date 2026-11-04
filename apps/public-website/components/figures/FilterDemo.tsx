"use client";
import { useMemo, useState } from "react";
import { LineChart, Slider, DemoTag } from "./Chart";

/** Second-order Butterworth low-pass (bilinear transform), applied forward and backward (zero phase). */
export function butterLowpass(x: number[], fcOverFs: number): number[] {
  const K = Math.tan(Math.PI * fcOverFs), r2 = Math.SQRT2;
  const norm = 1 / (1 + r2 * K + K * K);
  const b0 = K * K * norm, b1 = 2 * b0, b2 = b0;
  const a1 = 2 * (K * K - 1) * norm, a2 = (1 - r2 * K + K * K) * norm;
  const pass = (s: number[]) => {
    const y = new Array(s.length).fill(0);
    let x1 = s[0], x2 = s[0], y1 = s[0], y2 = s[0];
    for (let i = 0; i < s.length; i++) {
      const v = b0 * s[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = s[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
  return pass(pass(x).reverse()).reverse();
}

export function FilterDemo() {
  const raw = useMemo(() => Array.from({ length: 300 }, (_, i) =>
    Math.sin((2 * Math.PI * i) / 150) + 0.35 * Math.sin(i * 0.9) + 0.25 * Math.cos(i * 2.3) + (i === 90 ? 1.8 : 0)), []);
  const [fc, setFc] = useState(0.02);
  const y = useMemo(() => butterLowpass(raw, fc), [raw, fc]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap"><span className="font-semibold text-sm">Zero-phase Butterworth low-pass (order 2 × 2 passes)</span><DemoTag /></div>
      <Slider label="Normalised cut-off fc / fs" value={fc} min={0.005} max={0.2} step={0.005} onChange={setFc} format={(v) => v.toFixed(3)} />
      <LineChart ariaLabel="Noisy synthetic signal and its low-pass filtered version"
        series={[{ label: "Original", values: raw, color: "#B9C2BE", width: 1.2 }, { label: "Filtered", values: y, color: "var(--dr-accent)", width: 2.4 }]} />
      <p className="text-sm text-muted">Note the spike near the first third: filtering spreads it rather than removing it. Outliers should be flagged before filtering, and the original kept.</p>
    </div>
  );
}
