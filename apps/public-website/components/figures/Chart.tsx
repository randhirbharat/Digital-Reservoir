/* Minimal accessible SVG line chart used by the public demonstrations. */
export interface Series { label: string; values: (number | null)[]; color: string; width?: number; dash?: string }

export function LineChart({
  series, height = 240, yLabel, xLabels, ariaLabel, yDomain, markers,
}: {
  series: Series[]; height?: number; yLabel?: string; xLabels?: [string, string]; ariaLabel: string;
  yDomain?: [number, number]; markers?: { y: number; color: string; label: string }[];
}) {
  const W = 640, H = height, L = 46, R = 12, T = 14, B = 26;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)));
  markers?.forEach((m) => all.push(m.y));
  let [lo, hi] = yDomain ?? [Math.min(...all), Math.max(...all)];
  if (!yDomain) { const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad; }
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, n - 1);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const path = (vals: (number | null)[]) => {
    let d = "", pen = false;
    vals.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
    });
    return d;
  };
  const ticks = [hi, (hi + lo) / 2, lo];
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} className="block rounded-xl border border-line bg-bg">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--dr-line)" />
            <text x={6} y={y(t) + 4} fontSize="10" fill="var(--dr-muted)" fontFamily="var(--font-mono)">{Math.abs(t) >= 100 ? t.toFixed(0) : t.toFixed(2)}</text>
          </g>
        ))}
        {markers?.map((m, i) => (
          <g key={`m${i}`}>
            <line x1={L} x2={W - R} y1={y(m.y)} y2={y(m.y)} stroke={m.color} strokeDasharray="5 4" />
            <text x={W - R - 4} y={y(m.y) - 4} fontSize="10" textAnchor="end" fill={m.color} fontFamily="var(--font-mono)">{m.label}</text>
          </g>
        ))}
        {series.map((s) => (
          <path key={s.label} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} strokeLinejoin="round" />
        ))}
        {xLabels ? (
          <g fontSize="10" fill="var(--dr-muted)" fontFamily="var(--font-mono)">
            <text x={L} y={H - 8}>{xLabels[0]}</text>
            <text x={W - R} y={H - 8} textAnchor="end">{xLabels[1]}</text>
          </g>
        ) : null}
        {yLabel ? <text x={L} y={10} fontSize="10" fill="var(--dr-muted)">{yLabel}</text> : null}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-muted">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-2">
            <svg width="20" height="6" aria-hidden><line x1="0" x2="20" y1="3" y2="3" stroke={s.color} strokeWidth={3} strokeDasharray={s.dash} /></svg>
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick}
      className={`min-h-[44px] px-4 rounded-full border text-sm font-semibold transition-colors ${pressed ? "bg-accent text-on-accent border-accent" : "bg-surface text-ink border-line hover:border-accent"}`}>
      {children}
    </button>
  );
}

export function Slider({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between gap-3 font-semibold text-muted"><span>{label}</span><span className="font-mono text-ink">{format ? format(value) : value}</span></span>
      <input type="range" className="w-full accent-[var(--dr-accent)] mt-1" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function DemoTag({ children = "Synthetic example" }: { children?: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-bronze bg-bronze/15 text-bronze-ink px-2.5 py-0.5 text-[0.66rem] font-bold tracking-[0.08em] uppercase">{children}</span>;
}
