"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@dr/authentication";
import { buttonClass, EngineeringDisclaimer } from "@dr/design-system";
import { DatasetPicker, useDatasetSelection, type Picked } from "./DatasetPicker";
import { RunPanel } from "./results";
import { ErrorBox, PageTitle, Panel, Spinner } from "./ui";
import { errMsg, useApi } from "@/lib/useApi";
import type { DatasetFull, Run } from "@/lib/types";

export function useRunner() {
  const [run, setRun] = useState<Run | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const exec = useCallback(async (kind: string, body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try { setRun(await apiFetch<Run>(`/lab/analyses/${kind}`, { json: body })); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }, []);
  return { run, busy, err, exec };
}

export function AnalysisLayout({ title, lead, form, runner, submitLabel, canSubmit, onSubmit, needsDataset = true, onPicked }: {
  title: string; lead: ReactNode; form: (p: Picked) => ReactNode; runner: ReturnType<typeof useRunner>; submitLabel: string;
  canSubmit: (p: Picked) => boolean; onSubmit: (p: Picked) => void; needsDataset?: boolean; onPicked?: (p: Picked) => void;
}) {
  const [ds, setDs] = useState(""), [ver, setVer] = useState("");
  const { data: datasets } = useApi<DatasetFull[]>(needsDataset ? "/lab/datasets" : null);
  const picked = useDatasetSelection(ds, ver, datasets);
  const onPick = useCallback((d: string, v: string) => { setDs(d); setVer(v); }, []);
  useEffect(() => { if (picked.versionId) onPicked?.(picked); }, [picked.versionId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <PageTitle title={title} lead={lead} />
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5 min-w-0">
          {needsDataset ? <Panel title="1 · Data"><DatasetPicker datasetId={ds} versionId={ver} onChange={onPick} /></Panel> : null}
          <Panel title={needsDataset ? "2 · Configuration" : "Configuration"}>
            <form onSubmit={(e) => { e.preventDefault(); onSubmit(picked); }} className="space-y-1">
              {form(picked)}
              <ErrorBox>{runner.err}</ErrorBox>
              <button className={buttonClass("primary", "md", "w-full mt-3")} disabled={runner.busy || !canSubmit(picked)}>{runner.busy ? "Running…" : submitLabel}</button>
            </form>
          </Panel>
        </div>
        <div className="space-y-4 min-w-0">
          {runner.busy ? <Panel><Spinner label="Computing on the server…" /></Panel> : runner.run ? <RunPanel run={runner.run} /> : <Panel><p className="text-sm text-muted">Configure the analysis and run it. Results are saved and can be reopened from Saved analyses.</p></Panel>}
          <EngineeringDisclaimer />
        </div>
      </div>
    </>
  );
}
