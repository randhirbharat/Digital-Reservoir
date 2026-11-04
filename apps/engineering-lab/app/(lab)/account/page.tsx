"use client";
import { useState } from "react";
import { apiFetch, useSession } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import { ErrorBox, Field, Input, KV, PageTitle, Panel } from "@/components/ui";
import { errMsg, useApi } from "@/lib/useApi";

export default function Account() {
  const { user, refresh } = useSession();
  const { data: sessions, reload } = useApi<any[]>("/auth/sessions");
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null), [code, setCode] = useState(""), [msg, setMsg] = useState<string | null>(null), [err, setErr] = useState<string | null>(null);
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  if (!user) return null;
  const act = async (fn: () => Promise<unknown>, ok: string) => { setErr(null); setMsg(null); try { await fn(); setMsg(ok); await refresh(); reload(); } catch (x) { setErr(errMsg(x)); } };
  return (
    <>
      <PageTitle title="Account & security" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Profile">
          <KV items={[["Name", user.full_name], ["Email", user.email], ["Membership", user.membership_category], ["Email verified", user.email_verified ? "yes" : "no"], ["Lab permissions", user.lab_permissions.join(", ") || "none"], ["Digital Twin projects", user.twin_projects.length ? user.twin_projects.map((p) => `${p.project_name} (${p.role})`).join(", ") : "none"]]} />
          <p className="text-xs text-muted mt-3">Membership category changes and Digital Twin access are granted by administrators.</p>
        </Panel>
        <Panel title="Multi-factor authentication">
          {user.mfa_enabled ? (
            <div className="space-y-2"><p className="text-sm">MFA is <strong>enabled</strong>. Digital Twin projects and administrator actions may require it.</p>
              <Field label="Code to disable"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
              <button className={buttonClass("secondary", "sm")} onClick={() => act(() => apiFetch("/auth/mfa/disable", { json: { code } }), "MFA disabled.")}>Disable MFA</button></div>
          ) : setup ? (
            <div className="space-y-2 text-sm">
              <p>Add this account to an authenticator app (TOTP), then enter the current code.</p>
              <Field label="Secret key"><Input readOnly value={setup.secret} className="font-mono" /></Field>
              <Field label="Setup URI (for apps that accept it)"><Input readOnly value={setup.otpauth_uri} className="font-mono text-xs" /></Field>
              <Field label="Current 6-digit code"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
              <button className={buttonClass("primary", "sm")} onClick={() => act(async () => { await apiFetch("/auth/mfa/enable", { json: { code } }); setSetup(null); setCode(""); }, "MFA enabled.")}>Confirm and enable</button>
            </div>
          ) : <button className={buttonClass("primary", "sm")} onClick={() => act(async () => setSetup(await apiFetch("/auth/mfa/setup", { method: "POST" })), "")}>Set up MFA</button>}
        </Panel>
        <Panel title="Active sessions">
          <ul className="divide-y divide-line text-sm">
            {sessions?.map((s) => (
              <li key={s.id} className="py-2 flex flex-wrap justify-between gap-2">
                <span><span className="font-semibold">{s.current ? "This session" : (s.user_agent || "Unknown device").slice(0, 60)}</span><span className="block text-xs text-muted">{s.ip} · started {formatTimestamp(s.created_at)} · last seen {formatTimestamp(s.last_seen_at)}{s.mfa_passed ? " · MFA" : ""}</span></span>
                {!s.current ? <button className={buttonClass("secondary", "sm")} onClick={() => act(() => apiFetch(`/auth/sessions/${s.id}`, { method: "DELETE" }), "Session revoked.")}>Revoke</button> : null}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Change password">
          <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
          <Field label="New password"><Input type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
          <button className={buttonClass("primary", "sm", "mt-3")} onClick={() => act(() => apiFetch("/auth/password/change", { json: pw }), "Password changed. Other sessions were signed out.")}>Change password</button>
        </Panel>
      </div>
      <div className="mt-4 space-y-2"><ErrorBox>{err}</ErrorBox>{msg ? <p role="status" className="text-sm text-cond-normal">{msg}</p> : null}</div>
    </>
  );
}
