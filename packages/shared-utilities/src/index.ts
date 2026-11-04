/* Shared, framework-free utilities used by all three applications. */

export type AppId = "public" | "lab" | "twin";

/** Application base URLs come from environment configuration — never hard-coded domains.
 *  The `process.env.NEXT_PUBLIC_*` references must stay literal so Next.js inlines them into browser bundles. */
export function appUrls(): Record<AppId, string> {
  return {
    public: process.env.NEXT_PUBLIC_PUBLIC_URL || "http://localhost:3000",
    lab: process.env.NEXT_PUBLIC_LAB_URL || "http://localhost:3001",
    twin: process.env.NEXT_PUBLIC_TWIN_URL || "http://localhost:3002",
  };
}

/** Every displayed dataset/value must declare what it is. */
export type DataProvenance =
  | "live"
  | "historical"
  | "simulated"
  | "synthetic"
  | "imported"
  | "model"
  | "assumption"
  | "interpretation";

export const PROVENANCE_LABEL: Record<DataProvenance, { short: string; description: string }> = {
  live: { short: "Live measured", description: "Measured data received from a registered sensor/gateway in near real time." },
  historical: { short: "Historical measured", description: "Measured data from historical records or uploads." },
  simulated: { short: "Demonstration data", description: "Simulated data stream for demonstration. Not a measurement of any real structure." },
  synthetic: { short: "Synthetic example", description: "Synthetic example dataset generated for teaching or testing." },
  imported: { short: "Imported third-party", description: "Data imported from a third-party source; provenance recorded at import." },
  model: { short: "Model output", description: "Prediction or estimate produced by an analytical model." },
  assumption: { short: "User assumption", description: "Value defined by the user as an assumption." },
  interpretation: { short: "Interpretation", description: "Engineering interpretation; requires professional review." },
};

export type ConditionLevel = "normal" | "attention" | "warning" | "critical" | "unavailable" | "not_assessed";
export const CONDITION_LABEL: Record<ConditionLevel, string> = {
  normal: "Normal",
  attention: "Attention",
  warning: "Warning",
  critical: "Critical",
  unavailable: "Data unavailable",
  not_assessed: "Not assessed",
};

export function formatNumber(v: number | null | undefined, digits = 3): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return v.toExponential(2);
  return v.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function formatMeasurement(v: number | null | undefined, unit?: string | null, digits = 3): string {
  const n = formatNumber(v, digits);
  return n === "—" || !unit ? n : `${n} ${unit}`;
}

/** Timestamps are always shown with an explicit zone (UTC unless the caller passes a zone). */
export function formatTimestamp(iso: string | Date | null | undefined, timeZone = "UTC"): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const s = d.toLocaleString("en-GB", {
    timeZone, year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  return `${s} ${timeZone === "UTC" ? "UTC" : timeZone}`;
}

export function ageSeconds(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.max(0, (now - t) / 1000);
}

export function humanAge(seconds: number | null): string {
  if (seconds === null) return "never";
  if (seconds < 60) return `${Math.round(seconds)} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
}
