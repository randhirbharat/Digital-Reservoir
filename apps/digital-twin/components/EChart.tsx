"use client";
import { useEffect, useRef } from "react";

/** ECharts wrapper for high-density and live charts (dark technical theme). */
export function EChart({ option, height = 300, ariaLabel, onClick, notMerge = false }: { option: any; height?: number; ariaLabel: string; onClick?: (p: any) => void; notMerge?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<any>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  useEffect(() => {
    let disposed = false, ro: ResizeObserver | null = null;
    import("echarts").then((echarts) => {
      if (disposed || !el.current) return;
      inst.current = echarts.init(el.current, undefined, { renderer: "canvas" });
      inst.current.on("click", (p: any) => clickRef.current?.(p));
      ro = new ResizeObserver(() => inst.current?.resize());
      ro.observe(el.current);
      inst.current.setOption(withTheme(option), true);
    });
    return () => { disposed = true; ro?.disconnect(); inst.current?.dispose(); inst.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { inst.current?.setOption(withTheme(option), notMerge); }, [option, notMerge]);
  return <div ref={el} role="img" aria-label={ariaLabel} style={{ height }} className="w-full min-w-0" />;
}

function withTheme(o: any) {
  const axis = { axisLine: { lineStyle: { color: "#26434D" } }, axisLabel: { color: "#9DB3AE", hideOverlap: true }, splitLine: { lineStyle: { color: "#1A3440" } } };
  const merge = (a: any) => (Array.isArray(a) ? a.map((x) => ({ ...axis, ...x })) : { ...axis, ...a });
  return {
    backgroundColor: "transparent", animationDuration: 300, textStyle: { fontFamily: "Inter Variable, Inter, system-ui, sans-serif", color: "#E6EEEB" },
    color: ["#72BEB1", "#C9B591", "#8FB8E0", "#E0844F", "#B9C2BE", "#E0AE52"],
    grid: { left: 56, right: 18, top: 28, bottom: 52, containLabel: false, ...(o.grid || {}) },
    tooltip: { trigger: "axis", backgroundColor: "#10232D", borderColor: "#26434D", textStyle: { color: "#E6EEEB" }, ...(o.tooltip || {}) },
    legend: { textStyle: { color: "#B7CBC6" }, bottom: 0, ...(o.legend || {}) },
    ...o,
    xAxis: o.xAxis ? merge(o.xAxis) : undefined,
    yAxis: o.yAxis ? merge(o.yAxis) : undefined,
  };
}
