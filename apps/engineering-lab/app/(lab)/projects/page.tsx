"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import { ErrorBox, Field, Input, PageTitle, Panel, Spinner } from "@/components/ui";
import { errMsg, useApi } from "@/lib/useApi";

export default function Projects() {
  const { data, loading, reload } = useApi<any[]>("/lab/projects");
  const [name, setName] = useState(""), [desc, setDesc] = useState(""), [err, setErr] = useState<string | null>(null);
  async function create(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try { await apiFetch("/lab/projects", { json: { name, description: desc } }); setName(""); setDesc(""); reload(); } catch (x) { setErr(errMsg(x)); }
  }
  return (
    <>
      <PageTitle title="Projects" lead="Projects group datasets, analyses and reports. Deleting a project keeps its datasets and analyses (they become unassigned)." />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Panel title="Your projects">
          {loading ? <Spinner /> : data?.length ? (
            <ul className="divide-y divide-line">
              {data.map((p) => (
                <li key={p.id} className="py-3 flex flex-wrap justify-between gap-2">
                  <div><Link href={`/projects/${p.id}`} className="font-semibold text-accent-ink">{p.name}</Link><p className="text-sm text-muted">{p.description || "No description"}</p></div>
                  <div className="text-xs text-muted text-right">{p.dataset_count} datasets · {p.analysis_count} runs<br />updated {formatTimestamp(p.updated_at)}</div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No projects yet.</p>}
        </Panel>
        <Panel title="New project">
          <form onSubmit={create} className="space-y-1">
            <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Description"><textarea className="dr-field" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
            <ErrorBox>{err}</ErrorBox>
            <button className={buttonClass("primary", "md", "w-full mt-2")}>Create project</button>
          </form>
        </Panel>
      </div>
    </>
  );
}
