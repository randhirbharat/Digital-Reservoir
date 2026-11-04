"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiFetch } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { AuthFrame } from "@/components/AuthFrame";
import { ErrorBox, Field, Input } from "@/components/ui";
import { errMsg } from "@/lib/useApi";

export default function Page() {
  const [email, setEmail] = useState(""), [done, setDone] = useState(false), [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) { e.preventDefault(); try { await apiFetch("/auth/password/forgot", { json: { email } }); setDone(true); } catch (x) { setErr(errMsg(x)); } }
  return (
    <AuthFrame title="Reset your password" lead="We will email a reset link valid for 30 minutes.">
      {done ? <p className="text-sm">If an account exists for that address, a reset link has been sent.</p> : (
        <form onSubmit={submit} className="space-y-3">
          <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <ErrorBox>{err}</ErrorBox>
          <button className={buttonClass("primary", "lg", "w-full")}>Send reset link</button>
        </form>
      )}
      <Link href="/login" className="text-sm underline">Back to sign in</Link>
    </AuthFrame>
  );
}
