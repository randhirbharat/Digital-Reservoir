"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@dr/authentication";

export function Gate({ children }: { children: ReactNode }) {
  const { user, loading } = useSession(); const router = useRouter(); const path = usePathname() || "/";
  useEffect(() => { if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [loading, user, path, router]);
  if (loading || !user) return <div className="min-h-screen grid place-items-center text-sm text-muted" role="status">Checking authorisation…</div>;
  return <>{children}</>;
}
