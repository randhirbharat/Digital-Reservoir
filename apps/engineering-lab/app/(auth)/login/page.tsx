"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { apiFetch, useSession } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { AuthFrame } from "@/components/AuthFrame";
import { ErrorBox, Field, Input } from "@/components/ui";
import { errMsg } from "@/lib/useApi";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null), [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const next = params.get("next");
  const go = async () => { await refresh(); router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/"); };

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = await apiFetch<{ mfa_required: boolean; mfa_token?: string }>("/auth/login", { json: { email, password } });
      if (r.mfa_required) setMfaToken(r.mfa_token!); else await go();
    } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  }
  async function submitMfa(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await apiFetch("/auth/login/mfa", { json: { mfa_token: mfaToken, code } }); await go(); }
    catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  }

  if (mfaToken)
    return (
      <AuthFrame title="Two-step verification" lead="Enter the 6-digit code from your authenticator app.">
        <form onSubmit={submitMfa} className="space-y-3">
          <Field label="Authentication code"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="font-mono text-2xl tracking-[0.4em]" autoFocus /></Field>
          <ErrorBox>{err}</ErrorBox>
          <button className={buttonClass("primary", "lg", "w-full")} disabled={busy || code.length !== 6}>Verify and continue</button>
          <button type="button" className={buttonClass("secondary", "md", "w-full")} onClick={() => { setMfaToken(null); setCode(""); }}>Back</button>
        </form>
      </AuthFrame>
    );
  return (
    <AuthFrame title="Welcome back" lead="Use the same account for the Engineering Lab and the Digital Twin.">
      <form onSubmit={submit} className="space-y-1" noValidate>
        <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <div className="flex justify-end py-2 text-sm"><Link href="/forgot-password" className="text-accent-ink underline">Forgot password?</Link></div>
        <ErrorBox>{err}</ErrorBox>
        <button className={buttonClass("primary", "lg", "w-full mt-2")} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="text-sm text-center">New to the Lab? <Link href="/register" className="text-accent-ink font-semibold underline">Create an account</Link></p>
    </AuthFrame>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
