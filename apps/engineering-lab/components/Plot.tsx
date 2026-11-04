"use client";
import { useEffect, useRef, useState } from "react";

/** Plotly wrapper: lazy-loads plotly.js, applies the Lab theme, provides an accessible label and a data-table alternative. */
export function Plot({ data, layout = {}, height = 320, ariaLabel, table }: {
  data: any[]; layout?: Record<string, any>; height?: number; ariaLabel: string;
  table?: { columns: string[]; rows: (string | number | null)[][] };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTable, setShowTable] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
    import("plotly.js-dist-min").then(({ default: Plotly }) => {
      if (cancelled) return;
      const base = {
        height, margin: { l: 56, r: 16, t: 24, b: 44 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "#FBFCFB",
        font: { family: "Inter Variable, Inter, system-ui, sans-serif", size: 12, color: "#10232D" },
        xaxis: { gridcolor: "#E1E7E3", zeroline: false }, yaxis: { gridcolor: "#E1E7E3", zeroline: false },
        legend: { orientation: "h", y: -0.2 }, hovermode: "x unified",
        colorway: ["#183C45", "#9B8461", "#2C6B61", "#C0612B", "#5B7FA6", "#7B8790"],
      };
      const merged = { ...base, ...layout, xaxis: { ...base.xaxis, ...(layout.xaxis || {}) }, yaxis: { ...base.yaxis, ...(layout.yaxis || {}) } };
      Plotly.react(el, data, merged, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] });
    }).catch(() => setFailed(true));
    return () => { cancelled = true; };
  }, [data, layout, height]);
  useEffect(() => () => { const el = ref.current; if (el) import("plotly.js-dist-min").then(({ default: P }) => P.purge(el)).catch(() => {}); }, []);
  return (
    <figure className="m-0 min-w-0">
      <div ref={ref} role="img" aria-label={ariaLabel} style={{ minHeight: height }} className="w-full" />
      {failed ? <p className="text-sm text-cond-critical">Chart library failed to load.</p> : null}
      {table ? (
        <div className="mt-1">
          <button type="button" className="text-xs text-accent-ink underline" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>
            {showTable ? "Hide" : "Show"} data table
          </button>
          {showTable ? (
            <div className="dr-table-wrap mt-2 max-h-64 overflow-y-auto">
              <table className="dr-table"><thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{table.rows.slice(0, 300).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="font-mono">{v === null ? "—" : String(v)}</td>)}</tr>)}</tbody></table>
            </div>
          ) : null}
        </div>
      ) : null}
    </figure>
  );
}

export function line(name: string, s: { x: any[]; y: any[] } | undefined, extra: Record<string, any> = {}) {
  return s ? { type: "scatter", mode: "lines", name, x: s.x, y: s.y, line: { width: 1.6, ...(extra.line || {}) }, ...extra } : null;
}
export function seriesTable(named: [string, { x: any[]; y: any[] } | undefined][]) {
  const base = named.find(([, s]) => s)?.[1];
  if (!base) return undefined;
  return { columns: ["x", ...named.map(([n]) => n)], rows: base.x.map((x, i) => [String(x), ...named.map(([, s]) => (s?.y[i] ?? null) as number | null)]) };
}
