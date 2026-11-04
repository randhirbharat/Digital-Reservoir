"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, useSession } from "@dr/authentication";
import { AppSwitcher, LogoMark, buttonClass } from "@dr/design-system";
import { appUrls } from "@dr/shared-utilities";
import { Gate } from "@/components/Gate";
import { ErrorBox, Field, Panel } from "@/components/ui";

const ROLE_LABEL: Record<string, string> = { project_admin: "Project Administrator", project_engineer: "Project Engineer", researcher: "Researcher", monitoring_operator: "Monitoring Operator", viewer: "Read-only Viewer" };
const MATRIX: [string, boolean[]][] = [["View data & 3D model", [true, true, true, true, true]], ["Export data", [true, true, true, false, false]], ["Acknowledge / close alerts", [true, true, false, true, false]],
  ["Register sensors & gateways", [true, true, false, false, false]], ["Edit condition criteria", [true, true, false, false, false]], ["Manage members", [true, false, false, false, false]]];

function Projects() {
  const { user, logout } = useSession();
  const [data, setData] = useState<any>(null), [req, setReq] = useState<{ id: string; name: string } | null>(null), [why, setWhy] = useState(""), [role, setRole] = useState("viewer"), [err, setErr] = useState<string | null>(null);
  const load = () => apiFetch<any>("/twin/projects").then(setData).catch((e) => setErr(e.detail));
  useEffect(() => { void load(); }, []);
  async function send(e: FormEvent) { e.preventDefault(); setErr(null); try { await apiFetch(`/twin/projects/${req!.id}/access-requests`, { json: { role, justification: why } }); setReq(null); setWhy(""); load(); } catch (x: any) { setErr(x.detail); } }
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6 py-2.5">
        <div className="flex items-center gap-3"><LogoMark size={32} tone="dark" /><span className="leading-tight"><span className="block font-display font-extrabold tracking-[0.08em] text-[0.78rem] text-ivory">DIGITAL RESERVOIR</span><span className="block text-xs text-muted">Digital Twin</span></span></div>
        <div className="flex items-center gap-3 text-sm"><AppSwitcher current="twin" className="hidden sm:flex" />
          <span className={data?.session_mfa_passed ? "text-[#5FB592]" : "text-[#E0AE52]"}>{data?.session_mfa_passed ? "✓ MFA verified" : "MFA not verified"}</span>
          <button className={buttonClass("secondary", "sm")} onClick={async () => { await logout(); location.href = "/login"; }}>Sign out</button></div>
      </header>
      <main id="main" className="mx-auto max-w-[1360px] p-4 sm:p-6 space-y-5">
        <div><h1 className="font-display font-extrabold text-[clamp(1.5rem,2vw+0.8rem,2rem)] text-ivory">Your projects</h1>
          <p className="text-sm text-muted">Access is granted per project. Membership of one project never grants access to another.</p></div>
        {data && !data.session_mfa_passed ? <div role="note" className="rounded-[12px] border border-[#E0AE52]/50 bg-[#E0AE52]/10 p-3 text-sm">Projects require an MFA-verified session. {data.mfa_enabled ? "Sign out and sign in again with your authentication code." : <>Enable MFA under <a className="underline" href={`${appUrls().lab}/account`}>Engineering Lab › Account &amp; security</a>, then sign in again.</>}</div> : null}
        {data?.invitations?.map((i: any) => <div key={i.project_code} className="rounded-[12px] border border-aqua bg-[#10313A] p-3 text-sm">Invitation pending: <strong>{i.project_code} · {i.project_name}</strong> as {ROLE_LABEL[i.role]}. Open the link from your invitation email to accept (expires {new Date(i.expires_at).toUTCString()}).</div>)}
        <ErrorBox>{err}</ErrorBox>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {data?.projects.map((p: any) => (
            <div key={p.id} className="flex flex-col gap-2 rounded-[14px] border border-aqua/60 bg-surface p-4">
              <div className="flex justify-between text-xs"><span className="font-mono text-muted">{p.code}</span><span className="font-bold tracking-wide text-[#5FB592]">ACCESS GRANTED</span></div>
              <h2 className="font-display font-bold text-ivory">{p.name}</h2><p className="text-xs text-muted flex-1">{p.description}</p>
              <div className="text-xs">Your role: {ROLE_LABEL[p.role]}{p.data_mode === "simulated" ? " · demonstration data" : ""}</div>
              <Link href={`/p/${p.id}`} className={buttonClass("primary", "sm")}>Open project</Link>
            </div>
          ))}
          {data?.directory.map((p: any) => (
            <div key={p.id} className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface p-4">
              <div className="flex justify-between text-xs"><span className="font-mono text-muted">{p.code}</span><span className={`font-bold tracking-wide ${p.request_status === "pending" ? "text-[#E0AE52]" : "text-[#8E9AA2]"}`}>{p.request_status === "pending" ? "REQUEST PENDING" : p.request_status === "rejected" ? "REQUEST DECLINED" : "NO ACCESS"}</span></div>
              <h2 className="font-display font-bold text-ivory">{p.name}</h2><p className="text-xs text-muted flex-1">Project details are visible only to members.</p>
              <button className={buttonClass("secondary", "sm")} disabled={p.request_status === "pending"} onClick={() => setReq({ id: p.id, name: p.name })}>{p.request_status === "pending" ? "Awaiting approval" : "Request access"}</button>
            </div>
          ))}
          {data && !data.projects.length && !data.directory.length ? <p className="text-sm text-muted">No projects are available to you yet.</p> : null}
        </div>
        {req ? (
          <Panel title={`Request access · ${req.name}`}>
            <form onSubmit={send} className="space-y-2 max-w-[640px]">
              <Field label="Requested role"><select className="dr-field" value={role} onChange={(e) => setRole(e.target.value)}>{Object.entries(ROLE_LABEL).filter(([k]) => k !== "project_admin").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Justification (seen by the project administrators)"><textarea className="dr-field" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} minLength={10} required /></Field>
              <div className="flex gap-2"><button className={buttonClass("primary", "sm")}>Send request</button><button type="button" className={buttonClass("secondary", "sm")} onClick={() => setReq(null)}>Cancel</button></div>
            </form>
          </Panel>
        ) : null}
        <Panel title="Role permissions">
          <div className="dr-table-wrap"><table className="dr-table"><thead><tr><th>Capability</th>{Object.values(ROLE_LABEL).map((r) => <th key={r}>{r}</th>)}</tr></thead>
            <tbody>{MATRIX.map(([cap, row]) => <tr key={cap}><td>{cap}</td>{row.map((ok, i) => <td key={i} className="text-center">{ok ? "✓" : "–"}</td>)}</tr>)}</tbody></table></div>
          <p className="mt-2 text-xs text-muted">Enforced by the API on every request (not by hiding buttons). Signed in as {user?.email}.</p>
        </Panel>
      </main>
    </div>
  );
}
export default function Page() { return <Gate><Projects /></Gate>; }
