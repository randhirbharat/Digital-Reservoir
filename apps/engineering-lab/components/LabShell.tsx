"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppSwitcher, LogoMark, buttonClass } from "@dr/design-system";
import { useSession, apiFetch } from "@dr/authentication";
import { Spinner } from "./ui";

const NAV: { href: string; label: string; group?: string; perm?: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/datasets", label: "Datasets & processing", perm: "lab.datasets" },
  { href: "/analysis/signal", label: "Signal processing", group: "Analysis", perm: "lab.signal" },
  { href: "/analysis/statistics", label: "Statistics & PCA", perm: "lab.statistics" },
  { href: "/analysis/hst", label: "HST analysis", perm: "lab.hst" },
  { href: "/analysis/ml", label: "AI / ML laboratory", perm: "lab.ml" },
  { href: "/analysis/anomaly", label: "Damage detection", perm: "lab.anomaly" },
  { href: "/analysis/dhi", label: "Dam Health Index", perm: "lab.dhi" },
  { href: "/analysis/hybrid", label: "Hybrid physics–ML", group: "Advanced", perm: "lab.advanced" },
  { href: "/analysis/modal", label: "Modal analysis", perm: "lab.advanced" },
  { href: "/analysis/fragility", label: "Seismic fragility", perm: "lab.advanced" },
  { href: "/analysis/vision", label: "Image damage detection", perm: "lab.advanced" },
  { href: "/runs", label: "Saved analyses & reports", group: "Outputs" },
  { href: "/account", label: "Account & security" },
  { href: "/help", label: "Documentation" },
];

export function LabShell({ children }: { children: ReactNode }) {
  const { user, loading, logout, refresh } = useSession();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, pathname, router]);

  if (loading || !user) return <div className="min-h-screen grid place-items-center"><Spinner label="Checking your session…" /></div>;

  const perms = new Set(user.lab_permissions);
  const active = (h: string) => (h === "/" ? pathname === "/" : pathname.startsWith(h));
  return (
    <div className="min-h-screen lg:flex">
      <aside className="bg-navy text-[#DCE9E4] lg:w-[250px] lg:shrink-0 lg:min-h-screen">
        <div className="flex items-center justify-between gap-2 px-4 py-3 lg:py-4">
          <Link href="/" className="flex items-center gap-2.5 text-ivory">
            <LogoMark size={34} tone="dark" />
            <span className="leading-tight"><span className="block font-display font-extrabold tracking-[0.08em] text-[0.78rem]">DIGITAL RESERVOIR</span><span className="block text-xs text-[#9DB3AE] font-semibold">Engineering Lab</span></span>
          </Link>
          <button type="button" className="lg:hidden inline-flex size-11 items-center justify-center rounded-lg border border-[#26434D]" aria-expanded={menu} aria-controls="lab-nav" aria-label="Toggle navigation" onClick={() => setMenu((m) => !m)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
        <nav id="lab-nav" aria-label="Lab modules" className={`${menu ? "block" : "hidden"} lg:block px-3 pb-4`}>
          {NAV.map((n) => {
            const allowed = !n.perm || perms.has(n.perm);
            return (
              <div key={n.href}>
                {n.group ? <div className="px-3 pt-4 pb-1 text-[0.68rem] font-bold tracking-[0.14em] text-[#7F9893]">{n.group.toUpperCase()}</div> : null}
                <Link href={n.href} aria-current={active(n.href) ? "page" : undefined}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 min-h-[40px] text-sm ${active(n.href) ? "bg-teal text-ivory font-semibold" : "hover:bg-[#163040]"} ${allowed ? "" : "opacity-60"}`}>
                  <span>{n.label}</span>{allowed ? null : <span className="text-[0.65rem]" title="Not included in your membership category">locked</span>}
                </Link>
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6 py-2.5">
          <AppSwitcher current="lab" />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:flex flex-col leading-tight text-right"><span className="font-semibold">{user.full_name}</span><span className="text-xs text-muted capitalize">{user.membership_category}{user.mfa_enabled ? " · MFA on" : ""}</span></span>
            <button type="button" className={buttonClass("secondary", "sm")} onClick={async () => { await logout(); router.replace("/login"); }}>Sign out</button>
          </div>
        </header>
        {!user.email_verified ? <VerifyBanner email={user.email} onDone={refresh} /> : null}
        <main id="main" className="flex-1 p-4 sm:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function VerifyBanner({ email, onDone }: { email: string; onDone: () => void }) {
  const [sent, setSent] = useState(false);
  return (
    <div role="status" className="border-b border-cond-attention/50 bg-cond-attention/10 px-6 py-3 text-sm flex flex-wrap items-center gap-3">
      <span>Verify <strong>{email}</strong> to unlock analytical modules. Check your inbox for the link.</span>
      <button type="button" className="underline" onClick={async () => { await apiFetch("/auth/resend-verification", { json: { email } }); setSent(true); onDone(); }}>{sent ? "Link sent" : "Resend link"}</button>
    </div>
  );
}
