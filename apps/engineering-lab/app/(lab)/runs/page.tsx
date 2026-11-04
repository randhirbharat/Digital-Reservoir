"use client";
import Link from "next/link";
import { useState } from "react";
import { formatTimestamp } from "@dr/shared-utilities";
import { PageTitle, Panel, Select, Spinner } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import type { Run } from "@/lib/types";

export default function Runs() {
  const [kind, setKind] = useState("");
  const { data, loading } = useApi<Run[]>(`/lab/analyses?limit=300${kind ? `&kind=${kind}` : ""}`);
  return (
    <>
      <PageTitle title="Saved analyses & reports" lead="Every run stores its parameters, engine version and results. Reopen a run to view, export or generate its report." />
      <Panel actions={<div className="w-64"><Select aria-label="Filter by type" value={kind} onChange={(e) => setKind(e.target.value)} placeholder="All analysis types" options={["quality", "signal", "descriptive", "correlation", "regression", "pca", "factor", "timeseries", "hypothesis", "hst", "ml", "anomaly_zscore", "anomaly_cusum", "anomaly_changepoint", "anomaly_multivariate", "dhi"].map((k) => ({ value: k, label: k }))} /></div>} title="Runs">
        {loading ? <Spinner /> : data?.length ? (
          <div className="dr-table-wrap"><table className="dr-table"><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Created</th><th>Duration</th></tr></thead><tbody>
            {data.map((r) => <tr key={r.id}><td><Link href={`/runs/${r.id}`} className="font-semibold text-accent-ink">{r.title}</Link></td><td className="font-mono">{r.kind}</td><td className={r.status === "failed" ? "text-cond-critical" : ""}>{r.status}</td><td>{formatTimestamp(r.created_at)}</td><td className="font-mono">{r.duration_ms.toFixed(0)} ms</td></tr>)}
          </tbody></table></div>
        ) : <p className="text-sm text-muted">No saved analyses.</p>}
      </Panel>
    </>
  );
}
