"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { apiFetch, useSession } from "@dr/authentication";
import { Logo, buttonClass } from "@dr/design-system";
import { appUrls } from "@dr/shared-utilities";
import { ErrorBox, Field } from "@/components/ui";

function Inner() {
  const router = useRouter(), params = useSearchParams(), { refresh } = useSession();
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [mfa, setMfa] = useState<string | null>(null), [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const next = params.get("next");
  const done = async () => { await refresh(); router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/"); };
  const run = async (fn: () => Promise<void>) => { setErr(null); setBusy(true); try { await fn(); } catch (e: any) { setErr(e.detail ?? String(e)); } finally { setBusy(false); } };
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => { const r = await apiFetch<any>("/auth/login", { json: { email, password } }); if (r.mfa_required) setMfa(r.mfa_token); else await done(); }); };
  const submitMfa = (e: FormEvent) => { e.preventDefault(); run(async () => { await apiFetch("/auth/login/mfa", { json: { mfa_token: mfa, code } }); await done(); }); };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-6">
      <Logo tone="dark" size={42} product="Digital Twin" />
      <div className="w-full max-w-[420px] rounded-[18px] border border-line bg-surface p-6 sm:p-8 space-y-4">
        <div><h1 className="font-display font-bold text-2xl text-ivory">{mfa ? "Two-step verification" : "Authorised sign-in"}</h1>
          <p className="text-sm text-muted mt-1">{mfa ? "Enter the 6-digit code from your authenticator app." : "Access is granted per project by invitation or administrator approval. Multi-factor authentication is required."}</p></div>
        {mfa ? (
          <form onSubmit={submitMfa} className="space-y-3">
            <Field label="Authentication code"><input className="dr-field font-mono text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus /></Field>
            <ErrorBox>{err}</ErrorBox>
            <button className={buttonClass("primary", "lg", "w-full")} disabled={busy || code.length !== 6}>Verify and continue</button>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-1">
            <Field label="Email"><input className="dr-field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Password"><input className="dr-field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
            <div className="pt-2"><ErrorBox>{err}</ErrorBox></div>
            <button className={buttonClass("primary", "lg", "w-full mt-2")} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        )}
        <p className="text-xs text-muted">No account? Register in the <a className="underline text-accent-ink" href={`${appUrls().lab}/register`}>Engineering Lab</a>, enable MFA, then ask a project administrator for access. Forgot your password? <a className="underline text-accent-ink" href={`${appUrls().lab}/forgot-password`}>Reset it</a>.</p>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
