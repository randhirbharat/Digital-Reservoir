"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@dr/authentication";

export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try { setData(await apiFetch<T>(path)); setError(null); }
    catch (e) { setError(e instanceof ApiError ? e.detail : String(e)); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

export function errMsg(e: unknown) {
  return e instanceof ApiError ? e.detail : e instanceof Error ? e.message : String(e);
}
