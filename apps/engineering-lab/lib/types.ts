import type { ColumnInfo, DatasetVersion } from "@dr/shared-types";

export interface Series { x: (string | number)[]; y: (number | null)[]; n_total: number; downsampled: boolean }
export interface DatasetFull {
  id: string; name: string; filename: string; provenance: "historical" | "imported" | "synthetic" | "simulated"; description: string;
  project_id: string | null; time_column: string | null; units: Record<string, string>; created_at: string;
  versions: (DatasetVersion & { size_bytes: number; validation: Record<string, unknown> })[];
}
export interface Run {
  id: string; kind: string; title: string; dataset_version_id: string | null; project_id: string | null; params: Record<string, unknown>;
  status: "completed" | "failed"; error: string | null; created_at: string; duration_ms: number; engine_version: string; result?: any;
}
export type { ColumnInfo };

export const KIND_PATH: Record<string, string> = {
  quality: "/datasets", signal: "/analysis/signal", descriptive: "/analysis/statistics", correlation: "/analysis/statistics", regression: "/analysis/statistics",
  pca: "/analysis/statistics", factor: "/analysis/statistics", timeseries: "/analysis/statistics", hypothesis: "/analysis/statistics", hst: "/analysis/hst",
  ml: "/analysis/ml", anomaly_zscore: "/analysis/anomaly", anomaly_cusum: "/analysis/anomaly", anomaly_changepoint: "/analysis/anomaly",
  anomaly_multivariate: "/analysis/anomaly", dhi: "/analysis/dhi",
};
