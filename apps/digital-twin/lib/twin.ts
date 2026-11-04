"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiFetch } from "@dr/authentication";
import type { ConditionLevel, DataProvenance } from "@dr/shared-utilities";

export interface Reading {
  sensor_id: string; code: string; name: string; variable: string; value: number | null; unit: string; timestamp: string | null; ingested_at: string | null;
  quality: string | null; source: DataProvenance; comms: "online" | "late" | "offline" | "never"; status: string; condition: ConditionLevel; condition_basis: string;
}
export interface SensorRec {
  id: string; code: string; name: string; sensor_type: string; variable: string; unit: string; component_id: string | null; asset_id: string | null;
  x: number; y: number; z: number; frequency_s: number; source: DataProvenance; calibration: Record<string, unknown>; status: string; installed_at: string | null; notes: string;
}
export interface ProjectDetail {
  id: string; code: string; name: string; description: string; data_mode: string; require_mfa: boolean; role: string; permissions: string[];
  assets: { id: string; name: string; asset_type: string; description: string; is_illustrative: boolean; model_ref: string | null; geometry: any }[];
  components: { id: string; asset_id: string; code: string; name: string; kind: string }[]; sensor_count: number;
}
export interface AlertRec {
  id: string; sensor_id: string | null; rule_id: string | null; kind: string; severity: string; message: string; value: number | null; observed_at: string | null;
  source: DataProvenance; status: "open" | "acknowledged" | "closed"; created_at: string; acknowledged_at: string | null; closed_at: string | null; closure_note: string | null;
}

interface Ctx {
  project: ProjectDetail; sensors: SensorRec[]; readings: Reading[]; alerts: AlertRec[]; connected: boolean; lastMessage: string | null;
  can: (perm: string) => boolean; refresh: () => Promise<void>; subscribe: (fn: (ev: any) => void) => () => void;
}
export const ProjectCtx = createContext<Ctx | null>(null);
export const useProject = () => { const c = useContext(ProjectCtx); if (!c) throw new Error("no project"); return c; };

function wsUrl(path: string) {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return api.replace(/^http/, "ws") + path;
}

/** Loads project data and keeps it live: WebSocket stream with automatic reconnect plus periodic re-sync. */
export function useProjectState(pid: string) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [sensors, setSensors] = useState<SensorRec[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [alerts, setAlerts] = useState<AlertRec[]>([]);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLast] = useState<string | null>(null);
  const listeners = useRef(new Set<(ev: any) => void>());

  const refresh = useCallback(async () => {
    try {
      const [p, s, l, a] = await Promise.all([
        apiFetch<ProjectDetail>(`/twin/projects/${pid}`), apiFetch<SensorRec[]>(`/twin/projects/${pid}/sensors`),
        apiFetch<{ readings: Reading[] }>(`/twin/projects/${pid}/latest`), apiFetch<AlertRec[]>(`/twin/projects/${pid}/alerts?limit=200`),
      ]);
      setProject(p); setSensors(s); setReadings(l.readings); setAlerts(a); setError(null);
    } catch (e: any) { setError({ status: e.status ?? 0, detail: e.detail ?? String(e) }); }
  }, [pid]);

  useEffect(() => { void refresh(); const t = setInterval(refresh, 60000); return () => clearInterval(t); }, [refresh]);

  useEffect(() => {
    if (!project) return;
    let ws: WebSocket | null = null, stop = false, retry = 1000, timer: ReturnType<typeof setTimeout>;
    const open = () => {
      ws = new WebSocket(wsUrl(`/api/v1/twin/projects/${pid}/stream`));
      ws.onopen = () => { setConnected(true); retry = 1000; };
      ws.onclose = () => { setConnected(false); if (!stop) timer = setTimeout(open, (retry = Math.min(retry * 2, 30000))); };
      ws.onmessage = (m) => {
        const ev = JSON.parse(m.data);
        if (ev.type === "observation") {
          setLast(ev.ingested_at);
          setReadings((rs) => rs.map((r) => r.sensor_id === ev.sensor_id ? { ...r, value: ev.v, timestamp: ev.t, quality: ev.q, source: ev.source, ingested_at: ev.ingested_at, comms: "online" } : r));
        } else if (ev.type === "alert") {
          setAlerts((as) => [ev.alert, ...as.filter((a) => a.id !== ev.alert.id)]);
        }
        listeners.current.forEach((fn) => fn(ev));
      };
    };
    open();
    return () => { stop = true; clearTimeout(timer); ws?.close(); };
  }, [pid, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const subscribe = useCallback((fn: (ev: any) => void) => { listeners.current.add(fn); return () => { listeners.current.delete(fn); }; }, []);
  const can = useCallback((perm: string) => !!project?.permissions.includes(perm), [project]);
  return { project, sensors, readings, alerts, error, connected, lastMessage, refresh, subscribe, can };
}

export const VARIABLE_LABEL: Record<string, string> = {
  reservoir_level: "Reservoir level", radial_displacement: "Crest displacement (pendulum)", piezometric_head: "Piezometric levels", uplift_pressure: "Uplift pressure",
  seepage_flow: "Seepage", concrete_temperature: "Temperature", joint_opening: "Joint movements", tilt: "Inclinometers",
};

export const COND_COLOR: Record<string, string> = { normal: "#5FB592", attention: "#E0AE52", warning: "#E0844F", critical: "#E06A6A", unavailable: "#8E9AA2", not_assessed: "#9DB3AE" };
