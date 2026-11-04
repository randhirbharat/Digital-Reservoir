"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { apiFetch, useSession } from "@dr/authentication";
import { buttonClass } from "@dr/design-system";
import { appUrls } from "@dr/shared-utilities";
import { ErrorBox, Panel } from "@/components/ui";

function Inner() {
  const token = useSearchParams().get("token") || "";
  const { user, loading } = useSession(); const router = useRouter();
  const [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  if (loading) return null;
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-[480px]"><Panel title="Project invitation">
        {!user ? <p className="text-sm">Sign in to accept this invitation. <Link className="underline text-accent-ink" href={`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`}>Sign in</Link> · or <a className="underline text-accent-ink" href={`${appUrls().lab}/register`}>create an account</a> with the invited email address.</p> : (
          <div className="space-y-3 text-sm">
            <p>Signed in as <strong>{user.email}</strong>. The invitation must match this address. {user.session_mfa_passed ? "" : "This project requires an MFA-verified session: enable MFA under Engineering Lab › Account & security and sign in again with your code."}</p>
            <ErrorBox>{err}</ErrorBox>
            <button className={buttonClass("primary", "md")} disabled={busy} onClick={async () => { setBusy(true); setErr(null); try { const r = await apiFetch<any>("/twin/invitations/accept", { json: { token } }); router.replace(`/p/${r.project_id}`); } catch (e: any) { setErr(e.detail); } finally { setBusy(false); } }}>Accept invitation</button>
          </div>
        )}
      </Panel></div>
    </div>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
