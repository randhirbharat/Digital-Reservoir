"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { apiFetch } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { AuthFrame } from "@/components/AuthFrame";
import { ErrorBox, Field, Input } from "@/components/ui";
import { errMsg } from "@/lib/useApi";

function Inner() {
  const token = useSearchParams().get("token") || "";
  const [pw, setPw] = useState(""), [ok, setOk] = useState(false), [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) { e.preventDefault(); try { await apiFetch("/auth/password/reset", { json: { token, password: pw } }); setOk(true); } catch (x) { setErr(errMsg(x)); } }
  return (
    <AuthFrame title="Choose a new password" lead="All existing sessions are signed out after a reset.">
      {ok ? <Link href="/login" className={buttonClass("primary", "lg", "w-full")}>Sign in</Link> : (
        <form onSubmit={submit} className="space-y-3">
          <Field label="New password" hint="At least 12 characters with upper- and lower-case letters and a number."><Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <ErrorBox>{err}</ErrorBox>
          <button className={buttonClass("primary", "lg", "w-full")}>Update password</button>
        </form>
      )}
    </AuthFrame>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
