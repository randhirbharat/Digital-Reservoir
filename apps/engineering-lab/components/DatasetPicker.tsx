"use client";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { ProvenanceBadge } from "@dr/design-system";
import { useApi } from "@/lib/useApi";
import type { DatasetFull } from "@/lib/types";
import { Field, Select } from "./ui";

export interface Picked { dataset: DatasetFull | null; versionId: string; columns: { name: string; kind: string }[]; numeric: string[]; timeCols: string[] }

export function useDatasetSelection(datasetId: string, versionId: string, datasets: DatasetFull[] | null): Picked {
  return useMemo(() => {
    const dataset = datasets?.find((d) => d.id === datasetId) ?? null;
    const version = dataset?.versions.find((v) => v.id === versionId) ?? dataset?.versions[dataset.versions.length - 1];
    const columns = (version?.columns ?? []) as { name: string; kind: string }[];
    return { dataset, versionId: version?.id ?? "", columns, numeric: columns.filter((c) => c.kind === "numeric").map((c) => c.name), timeCols: columns.filter((c) => c.kind === "datetime").map((c) => c.name) };
  }, [datasetId, versionId, datasets]);
}

/** Choose a dataset and version; the latest version is selected by default. */
export function DatasetPicker({ datasetId, versionId, onChange }: { datasetId: string; versionId: string; onChange: (d: string, v: string) => void }) {
  const { data: datasets, loading } = useApi<DatasetFull[]>("/lab/datasets");
  const sel = useDatasetSelection(datasetId, versionId, datasets);
  useEffect(() => {
    if (datasets?.length && !datasetId) {
      const params = new URLSearchParams(window.location.search);
      const want = datasets.find((d) => d.id === params.get("dataset")) ?? datasets[0];
      onChange(want.id, want.versions[want.versions.length - 1].id);
    }
  }, [datasets, datasetId, onChange]);
  if (!loading && !datasets?.length)
    return <p className="text-sm">No datasets yet. <Link href="/datasets" className="text-accent-ink underline">Upload one or import a synthetic sample</Link>.</p>;
  return (
    <div className="space-y-2">
      <Field label="Dataset">
        <Select value={datasetId} onChange={(e) => { const d = datasets!.find((x) => x.id === e.target.value)!; onChange(d.id, d.versions[d.versions.length - 1].id); }}
          options={(datasets ?? []).map((d) => ({ value: d.id, label: d.name }))} />
      </Field>
      {sel.dataset ? (
        <>
          <Field label="Version">
            <Select value={sel.versionId} onChange={(e) => onChange(datasetId, e.target.value)}
              options={sel.dataset.versions.map((v) => ({ value: v.id, label: `v${v.version} · ${v.label} (${v.rows} rows)` }))} />
          </Field>
          <ProvenanceBadge kind={sel.dataset.provenance === "historical" ? "historical" : sel.dataset.provenance} />
        </>
      ) : null}
    </div>
  );
}
