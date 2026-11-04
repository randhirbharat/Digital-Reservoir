"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { AuthFrame } from "@/components/AuthFrame";
import { ErrorBox, Field, Input, Select } from "@/components/ui";
import { errMsg } from "@/lib/useApi";

const RULES: [string, (p: string) => boolean][] = [
  ["12+ characters", (p) => p.length >= 12],
  ["upper and lower case", (p) => /[a-z]/.test(p) && /[A-Z]/.test(p)],
  ["a number", (p) => /\d/.test(p)],
];

export default function RegisterPage() {
  const [f, setF] = useState({ full_name: "", email: "", organisation: "", membership_category: "researcher", password: "", accept_terms: false });
  const [err, setErr] = useState<string | null>(null), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string; checked?: boolean; type?: string } }) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await apiFetch("/auth/register", { json: f }); setDone(true); } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  }
  if (done)
    return (
      <AuthFrame title="Verify your email" lead="If the address can be registered, we have sent a verification link valid for 24 hours.">
        <p className="text-sm">Analytical modules unlock after verification. Digital Twin access is granted separately by project invitation or approval.</p>
        <Link href="/login" className={buttonClass("primary", "lg", "w-full")}>Go to sign in</Link>
      </AuthFrame>
    );
  return (
    <AuthFrame title="Create a Lab account" lead="Free registration. Digital Twin access is granted separately.">
      <form onSubmit={submit} className="space-y-1">
        <Field label="Full name"><Input autoComplete="name" required value={f.full_name} onChange={set("full_name")} /></Field>
        <Field label="Email"><Input type="email" autoComplete="email" required value={f.email} onChange={set("email")} /></Field>
        <Field label="Organisation (optional)"><Input autoComplete="organization" value={f.organisation} onChange={set("organisation")} /></Field>
        <Field label="Membership category" hint="Determines available modules and upload limits. Administrators can change it later.">
          <Select value={f.membership_category} onChange={set("membership_category")} options={[{ value: "general", label: "General member" }, { value: "student", label: "Student" }, { value: "researcher", label: "Researcher" }, { value: "professional", label: "Professional member" }]} />
        </Field>
        <Field label="Password"><Input type="password" autoComplete="new-password" required value={f.password} onChange={set("password")} aria-describedby="pw-rules" /></Field>
        <ul id="pw-rules" className="grid grid-cols-2 gap-1 text-xs py-1">
          {RULES.map(([l, ok]) => <li key={l} className={ok(f.password) ? "text-cond-normal" : "text-muted"}>{ok(f.password) ? "✓" : "○"} {l}</li>)}
          <li className="text-muted">○ not a common password</li>
        </ul>
        <label className="flex items-start gap-2 text-sm py-2"><input type="checkbox" className="mt-1 size-4" checked={f.accept_terms} onChange={set("accept_terms")} required />I accept the terms of use and understand that Lab outputs are not engineering certification.</label>
        <ErrorBox>{err}</ErrorBox>
        <button className={buttonClass("primary", "lg", "w-full mt-2")} disabled={busy || !f.accept_terms}>{busy ? "Creating…" : "Create account"}</button>
      </form>
      <p className="text-sm text-center">Already registered? <Link href="/login" className="text-accent-ink font-semibold underline">Sign in</Link></p>
    </AuthFrame>
  );
}
