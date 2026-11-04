"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@dr/authentication";

export interface ObsResponse { sensor: any; n_total: number; downsampled: boolean; method: string | null; sources: string[]; points: { t: string; v: number | null; q: string }[] }

export function useSeries(pid: string, sensorId: string | null, start: Date, end: Date | null, maxPoints = 1500) {
  const [data, setData] = useState<ObsResponse | null>(null), [loading, setLoading] = useState(false);
  const s = start.toISOString(), e = end?.toISOString();
  const load = useCallback(async () => {
    if (!sensorId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ start: s, max_points: String(maxPoints), ...(e ? { end: e } : {}) });
      setData(await apiFetch<ObsResponse>(`/twin/projects/${pid}/sensors/${sensorId}/observations?${qs}`));
    } finally { setLoading(false); }
  }, [pid, sensorId, s, e, maxPoints]);
  useEffect(() => { void load(); }, [load]);
  return { data, setData, loading, reload: load };
}
