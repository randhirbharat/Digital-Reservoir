"use client";
import { useState } from "react";
import { Slider, DemoTag } from "./Chart";

const IND = ["Displacement residual", "Uplift trend", "Seepage", "Drain efficiency"];

export function DhiDemo() {
  const [vals, setVals] = useState([0.85, 0.7, 0.9, 0.6]);
  const [w, setW] = useState([0.3, 0.3, 0.2, 0.2]);
  const sw = w.reduce((a, b) => a + b, 0) || 1, wn = w.map((x) => x / sw);
  const arith = vals.reduce((a, v, i) => a + v * wn[i], 0);
  const geom = Math.exp(vals.reduce((a, v, i) => a + wn[i] * Math.log(Math.max(v, 1e-6)), 0));
  const minv = Math.min(...vals);
  const set = (arr: number[], i: number, v: number, f: (a: number[]) => void) => { const c = arr.slice(); c[i] = v; f(c); };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap"><span className="font-semibold text-sm">Aggregating normalised indicators</span><DemoTag>Illustrative weights — not validated criteria</DemoTag></div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 grid-cols-1 min-w-0">
        {IND.map((name, i) => (
          <div key={name} className="space-y-1 rounded-xl border border-line p-3">
            <div className="text-sm font-semibold">{name}</div>
            <Slider label="Indicator Iᵢ (1 = best)" value={vals[i]} min={0} max={1} step={0.05} onChange={(v) => set(vals, i, v, setVals)} format={(v) => v.toFixed(2)} />
            <Slider label="Weight wᵢ" value={w[i]} min={0} max={1} step={0.05} onChange={(v) => set(w, i, v, setW)} format={() => wn[i].toFixed(2)} />
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-3 gap-2 font-mono text-sm grid-cols-1 min-w-0">
        <span>Weighted arithmetic: {arith.toFixed(3)}</span><span>Weighted geometric: {geom.toFixed(3)}</span><span>Worst indicator: {minv.toFixed(2)}</span>
      </div>
      <p className="text-sm text-muted">Arithmetic aggregation lets good indicators compensate for a poor one; geometric and minimum-based aggregation do not. The choice is an engineering decision that must be documented.</p>
    </div>
  );
}
