"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { apiFetch } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { AuthFrame } from "@/components/AuthFrame";
import { ErrorBox, Spinner } from "@/components/ui";
import { errMsg } from "@/lib/useApi";

function Inner() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "ok" | "error">("working"), [err, setErr] = useState<string | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; ran.current = true;
    if (!token) { setState("error"); setErr("Missing verification token."); return; }
    apiFetch("/auth/verify-email", { json: { token } }).then(() => setState("ok")).catch((e) => { setState("error"); setErr(errMsg(e)); });
  }, [token]);
  return (
    <AuthFrame title="Email verification">
      {state === "working" ? <Spinner label="Verifying…" /> : null}
      {state === "ok" ? <><p>Your email is verified.</p><Link href="/login" className={buttonClass("primary", "lg", "w-full")}>Sign in</Link></> : null}
      {state === "error" ? <><ErrorBox>{err}</ErrorBox><Link href="/login" className="text-sm underline">Back to sign in</Link></> : null}
    </AuthFrame>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
