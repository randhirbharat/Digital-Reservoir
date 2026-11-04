"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@dr/authentication";
import { ProvenanceBadge, buttonClass } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import { ErrorBox, Field, Input, PageTitle, Panel, Spinner } from "@/components/ui";
import { errMsg, useApi } from "@/lib/useApi";
import type { DatasetFull, Run } from "@/lib/types";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: projects } = useApi<any[]>("/lab/projects");
  const project = projects?.find((p) => p.id === id);
  const { data: datasets } = useApi<DatasetFull[]>(`/lab/datasets?project_id=${id}`);
  const { data: runs } = useApi<Run[]>(`/lab/analyses?project_id=${id}`);
  const [name, setName] = useState(""), [desc, setDesc] = useState(""), [err, setErr] = useState<string | null>(null), [saved, setSaved] = useState(false);
  useEffect(() => { if (project) { setName(project.name); setDesc(project.description); } }, [project]);
  if (!projects) return <Spinner />;
  if (!project) return <p>Project not found.</p>;
  return (
    <>
      <PageTitle title={project.name} lead={project.description}
        actions={<button className={buttonClass("danger", "sm")} onClick={async () => { if (confirm("Delete this project? Datasets and analyses are kept.")) { await apiFetch(`/lab/projects/${id}`, { method: "DELETE" }); router.push("/projects"); } }}>Delete project</button>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_320px]">
        <Panel title="Datasets">
          {datasets?.length ? datasets.map((d) => <Link key={d.id} href={`/datasets/${d.id}`} className="flex justify-between gap-2 rounded-lg px-2 py-2 hover:bg-surface-2"><span>{d.name}</span><ProvenanceBadge kind={d.provenance === "historical" ? "historical" : d.provenance} /></Link>) : <p className="text-sm text-muted">Assign datasets to this project from the dataset page.</p>}
        </Panel>
        <Panel title="Analyses">
          {runs?.length ? runs.map((r) => <Link key={r.id} href={`/runs/${r.id}`} className="block rounded-lg px-2 py-2 hover:bg-surface-2"><span className="font-semibold text-sm">{r.title}</span><span className="block text-xs text-muted">{formatTimestamp(r.created_at)}</span></Link>) : <p className="text-sm text-muted">No analyses yet.</p>}
        </Panel>
        <Panel title="Edit project">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Description"><textarea className="dr-field" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <ErrorBox>{err}</ErrorBox>
          <button className={buttonClass("primary", "md", "w-full mt-2")} onClick={async () => { try { await apiFetch(`/lab/projects/${id}`, { method: "PATCH", json: { name, description: desc } }); setSaved(true); } catch (x) { setErr(errMsg(x)); } }}>{saved ? "Saved" : "Save"}</button>
        </Panel>
      </div>
    </>
  );
}
