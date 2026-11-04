"use client";
import Link from "next/link";
import { useSession } from "@dr/authentication";
import { Stat, buttonClass } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import { PageTitle, Panel, Spinner } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import type { Run } from "@/lib/types";

const TOOLS: [string, string, string, string][] = [
  ["/datasets", "Data quality", "gaps · duplicates · outliers · resampling", "lab.datasets"],
  ["/analysis/signal", "Signal processing", "filters · FFT · PSD · wavelets · STL", "lab.signal"],
  ["/analysis/statistics", "Regression & PCA", "diagnostics · intervals · ACF", "lab.statistics"],
  ["/analysis/hst", "HST model", "calibrate · validate · predict", "lab.hst"],
  ["/analysis/ml", "ML laboratory", "train · compare · explain", "lab.ml"],
  ["/analysis/anomaly", "Damage detection", "residual · CUSUM · change points", "lab.anomaly"],
  ["/analysis/dhi", "Dam Health Index", "AHP · sensitivity", "lab.dhi"],
];

export default function Dashboard() {
  const { user } = useSession();
  const { data, loading, error } = useApi<any>(user?.lab_access ? "/lab/dashboard" : null);
  const { data: projects } = useApi<any[]>(user?.lab_access ? "/lab/projects" : null);
  const perms = new Set(user?.lab_permissions ?? []);
  return (
    <>
      <PageTitle title={`Welcome, ${user?.full_name.split(" ")[0] ?? ""}`} lead="Continue an analysis or start a new workflow. Original uploads are never modified."
        actions={<><Link href="/projects" className={buttonClass("secondary")}>New project</Link><Link href="/datasets" className={buttonClass("secondary")}>Upload CSV / Excel</Link><Link href="/analysis/hst" className={buttonClass("primary")}>Run HST analysis</Link></>} />
      {!user?.lab_access ? <Panel><p>Verify your email address to unlock the Lab.</p></Panel> : loading ? <Spinner /> : error ? <p className="text-cond-critical">{error}</p> : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Projects" value={data.counts.projects} />
            <Stat label="Datasets" value={data.counts.datasets} hint={`${data.counts.versions} versions · originals preserved`} />
            <Stat label="Analysis runs" value={data.counts.analyses} hint="reproducible: parameters stored" />
            <Stat label="Computation used" value={data.usage.compute_seconds} unit="s" hint={`${(data.usage.storage_bytes / 1048576).toFixed(1)} MB stored`} />
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <div className="space-y-5 min-w-0">
              <Panel title="Recent analysis runs" actions={<Link href="/runs" className="text-sm font-semibold text-accent-ink">All runs</Link>}>
                {data.recent_runs.length ? (
                  <div className="dr-table-wrap"><table className="dr-table"><thead><tr><th>Run</th><th>Status</th><th>When</th></tr></thead><tbody>
                    {data.recent_runs.map((r: Run) => <tr key={r.id}><td><Link href={`/runs/${r.id}`} className="font-semibold text-accent-ink">{r.title}</Link></td><td>{r.status}</td><td>{formatTimestamp(r.created_at)}</td></tr>)}
                  </tbody></table></div>
                ) : <p className="text-sm text-muted">No analyses yet. Import a synthetic sample on the Datasets page to try the tools.</p>}
              </Panel>
              <Panel title="Available tools">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {TOOLS.map(([href, t, d, perm]) => (
                    <Link key={href} href={href} className={`rounded-[10px] bg-surface-2 p-3 hover:outline hover:outline-1 hover:outline-accent ${perms.has(perm) ? "" : "opacity-55"}`}>
                      <div className="font-semibold text-sm">{t}{perms.has(perm) ? "" : " · locked"}</div><div className="text-xs text-muted">{d}</div>
                    </Link>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="space-y-5 min-w-0">
              <Panel title="Projects" actions={<Link href="/projects" className="text-sm font-semibold text-accent-ink">Manage</Link>}>
                {projects?.length ? projects.slice(0, 6).map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface-2"><span className="font-semibold">{p.name}</span><span className="text-xs text-muted">{p.dataset_count} datasets · {p.analysis_count} runs</span></Link>
                )) : <p className="text-sm text-muted">No projects yet.</p>}
              </Panel>
              <Panel title="Notifications">
                <ul className="space-y-2 text-sm">
                  {data.notifications.map((n: any, i: number) => <li key={i} className="flex gap-2"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.outcome === "success" ? "bg-bronze" : "bg-cond-critical"}`} /><span>{n.action.replace("lab.", "").replaceAll("_", " ")} {n.detail?.kind ? `· ${n.detail.kind}` : ""} {n.detail?.status === "failed" ? "(failed)" : ""}<span className="block text-xs text-muted">{formatTimestamp(n.at)}</span></span></li>)}
                  {!data.notifications.length ? <li className="text-muted">Nothing yet.</li> : null}
                </ul>
              </Panel>
              <Panel title="Help"><p className="text-sm">Start with the <Link href="/help" className="underline">documentation</Link>: data provenance, chronological validation and how to read each output.</p></Panel>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
