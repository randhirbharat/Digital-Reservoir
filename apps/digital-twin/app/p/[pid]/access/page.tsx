"use client";
import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import { ErrorBox, Field, Panel } from "@/components/ui";
import { useProject } from "@/lib/twin";

const ROLES: [string, string][] = [["project_admin", "Project Administrator"], ["project_engineer", "Project Engineer"], ["researcher", "Researcher"], ["monitoring_operator", "Monitoring Operator"], ["viewer", "Read-only Viewer"]];

export default function Access() {
  const { project, can } = useProject();
  const admin = can("members_manage");
  const [members, setMembers] = useState<any[]>([]), [invites, setInvites] = useState<any[]>([]), [reqs, setReqs] = useState<any[]>([]), [audit, setAudit] = useState<any[]>([]);
  const [inv, setInv] = useState({ email: "", role: "viewer" }), [err, setErr] = useState<string | null>(null), [msg, setMsg] = useState<string | null>(null);
  const load = async () => {
    setMembers(await apiFetch(`/twin/projects/${project.id}/members`));
    if (admin) { setInvites(await apiFetch(`/twin/projects/${project.id}/invitations`)); setReqs(await apiFetch(`/twin/projects/${project.id}/access-requests`)); setAudit(await apiFetch(`/twin/projects/${project.id}/audit?limit=60`)); }
  };
  useEffect(() => { void load(); }, [admin]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn: () => Promise<any>, ok: string) => { setErr(null); setMsg(null); try { await fn(); setMsg(ok); await load(); } catch (x: any) { setErr(x.detail); } };
  return (
    <div className="space-y-4">
      <h1 className="font-display font-extrabold text-xl text-ivory">Project access · {project.code}</h1>
      <ErrorBox>{err}</ErrorBox>{msg ? <p role="status" className="text-sm text-[#5FB592]">{msg}</p> : null}
      <Panel title="Members">
        <div className="dr-table-wrap"><table className="dr-table"><thead><tr><th>Member</th><th>Role</th><th>MFA</th><th>Last seen</th><th>Status</th>{admin ? <th><span className="sr-only">Actions</span></th> : null}</tr></thead><tbody>
          {members.map((m) => (
            <tr key={m.user_id}><td><div className="font-semibold text-ivory">{m.name}{m.is_you ? " (you)" : ""}</div><div className="text-xs text-muted">{m.email ?? m.organisation}</div></td>
              <td>{admin && !m.is_you && !m.revoked_at ? <select aria-label={`Role of ${m.name}`} className="dr-field !min-h-[34px] !py-0" value={m.role} onChange={(e) => { if (confirm(`Change role to ${e.target.value}? The member's sessions will end.`)) act(() => apiFetch(`/twin/projects/${project.id}/members/${m.user_id}`, { method: "PATCH", json: { role: e.target.value } }), "Role updated."); }}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> : ROLES.find(([v]) => v === m.role)?.[1]}</td>
              <td className={m.mfa_enabled ? "text-[#5FB592]" : "text-[#E0AE52]"}>{m.mfa_enabled ? "enabled" : "not set"}</td><td className="font-mono text-xs">{formatTimestamp(m.last_seen_at)}</td><td>{m.revoked_at ? "revoked" : "active"}</td>
              {admin ? <td>{!m.is_you && !m.revoked_at ? <button className="rounded-md border border-[#E06A6A]/60 px-2 py-1 text-xs text-[#F2B8B8]" onClick={() => { if (confirm(`Revoke access for ${m.name}?`)) act(() => apiFetch(`/twin/projects/${project.id}/members/${m.user_id}`, { method: "DELETE" }), "Access revoked; sessions terminated."); }}>Revoke</button> : null}</td> : null}</tr>
          ))}
        </tbody></table></div>
      </Panel>
      {admin ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Invite a member">
            <form className="space-y-1" onSubmit={(e: FormEvent) => { e.preventDefault(); act(() => apiFetch(`/twin/projects/${project.id}/invitations`, { json: inv }), `Invitation sent to ${inv.email}.`).then(() => setInv({ ...inv, email: "" })); }}>
              <Field label="Email"><input className="dr-field" type="email" required value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} /></Field>
              <Field label="Role"><select className="dr-field" value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <button className={buttonClass("primary", "sm", "mt-2")}>Send invitation</button>
            </form>
            <ul className="mt-3 space-y-1 text-xs text-muted">{invites.slice(0, 8).map((i) => <li key={i.id}>{i.email} · {i.role} · {i.status} · expires {formatTimestamp(i.expires_at)}</li>)}</ul>
          </Panel>
          <Panel title="Access requests">
            <ul className="space-y-2">{reqs.filter((r) => r.status === "pending").map((r) => (
              <li key={r.id} className="rounded-[10px] border border-line p-2.5 text-sm"><div className="font-semibold">{r.name} · {r.email}</div><div className="text-xs text-muted">{r.organisation} · requests {r.role}</div><p className="mt-1 text-sm">{r.justification}</p>
                <div className="mt-2 flex gap-2"><button className={buttonClass("primary", "sm")} onClick={() => act(() => apiFetch(`/twin/projects/${project.id}/access-requests/${r.id}/decide`, { json: { approve: true } }), "Approved.")}>Approve</button><button className={buttonClass("secondary", "sm")} onClick={() => act(() => apiFetch(`/twin/projects/${project.id}/access-requests/${r.id}/decide`, { json: { approve: false } }), "Rejected.")}>Reject</button></div></li>))}
              {!reqs.some((r) => r.status === "pending") ? <li className="text-sm text-muted">No pending requests.</li> : null}</ul>
          </Panel>
          <Panel title="Access audit trail" className="xl:col-span-2">
            <div className="dr-table-wrap max-h-[420px] overflow-y-auto"><table className="dr-table"><thead><tr><th>Time (UTC)</th><th>User</th><th>Action</th><th>Outcome</th><th>Target</th><th>IP</th></tr></thead><tbody>
              {audit.map((a, i) => <tr key={i}><td className="font-mono text-xs">{formatTimestamp(a.at)}</td><td>{a.user}</td><td className="font-mono text-xs">{a.action}</td><td className={a.outcome === "denied" ? "text-[#E0AE52]" : ""}>{a.outcome}</td><td className="text-xs">{a.target ?? "—"}</td><td className="font-mono text-xs">{a.ip}</td></tr>)}
            </tbody></table></div>
          </Panel>
        </div>
      ) : <p className="text-sm text-muted">Only project administrators can manage members, invitations and requests.</p>}
    </div>
  );
}
