"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@dr/authentication";
import { AppSwitcher, LogoMark, buttonClass } from "@dr/design-system";
import { formatTimestamp } from "@dr/shared-utilities";
import { ProjectCtx, useProjectState } from "@/lib/twin";
import { DemoBanner } from "./ui";

const ROLE_LABEL: Record<string, string> = { project_admin: "Project Administrator", project_engineer: "Project Engineer", researcher: "Researcher", monitoring_operator: "Monitoring Operator", viewer: "Read-only Viewer" };

export function ProjectShell({ pid, children }: { pid: string; children: ReactNode }) {
  const st = useProjectState(pid);
  const { logout } = useSession();
  const path = usePathname() || "";
  if (st.error) return (
    <div className="min-h-screen grid place-items-center p-6 text-center"><div className="space-y-3 max-w-[460px]">
      <h1 className="font-display text-xl text-ivory">{st.error.status === 404 ? "Project not available" : st.error.status === 403 ? "Additional verification required" : "Could not load project"}</h1>
      <p className="text-sm text-muted">{st.error.status === 404 ? "This project does not exist or you are not a member." : st.error.detail}</p>
      <Link href="/" className={buttonClass("primary", "sm")}>Back to your projects</Link></div></div>
  );
  if (!st.project) return <div className="min-h-screen grid place-items-center text-sm text-muted" role="status">Loading project…</div>;
  const nav: [string, string, string][] = [["", "Overview", "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"], ["/model", "3D model", "M12 2l9 5v10l-9 5-9-5V7zM12 22V12M21 7l-9 5-9-5"],
    ["/monitoring", "Monitoring", "M2 12h4l2-6 4 12 3-9 2 3h5"], ["/sensors", "Sensors", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"],
    ["/alerts", "Alerts & criteria", "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"], ["/access", "Access", "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4"]];
  const base = `/p/${pid}`;
  const open = st.alerts.filter((a) => a.status === "open").length;
  return (
    <ProjectCtx.Provider value={{ ...st, project: st.project }}>
      <div className="min-h-screen flex flex-col overflow-x-clip">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-3 sm:px-5 py-2.5">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <Link href="/" className="flex items-center gap-2.5 text-ivory"><LogoMark size={30} tone="dark" /><span className="hidden sm:block leading-tight"><span className="block font-display font-extrabold tracking-[0.08em] text-[0.72rem]">DIGITAL RESERVOIR</span><span className="block text-xs text-muted">Digital Twin</span></span></Link>
            <Link href="/" className="rounded-[9px] border border-line px-3 py-1.5 text-sm font-semibold text-ivory truncate max-w-[70vw]" title="Switch project">{st.project.code} · {st.project.name}</Link>
            <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">{ROLE_LABEL[st.project.role] ?? st.project.role}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs min-w-0">
            <span role="status" className="flex items-center gap-1.5 text-muted min-w-0"><span className={`size-2 shrink-0 rounded-full ${st.connected ? "bg-[#5FB592]" : "bg-[#8E9AA2]"}`} />{st.connected ? <>Live stream<span className="hidden sm:inline">{` · ${st.lastMessage ? formatTimestamp(st.lastMessage) : "connected"}`}</span></> : "Stream reconnecting…"}</span>
            <AppSwitcher current="twin" className="hidden lg:flex" />
            <button className={buttonClass("secondary", "sm")} onClick={async () => { await logout(); location.href = "/login"; }}>Sign out</button>
          </div>
        </header>
        {st.project.data_mode === "simulated" ? <DemoBanner /> : null}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0">
          <nav aria-label="Twin sections" className="md:w-[84px] shrink-0 min-w-0 max-w-full border-b md:border-b-0 md:border-r border-line bg-surface flex md:flex-col gap-1 p-2 overflow-x-auto">
            {nav.map(([p, label, d]) => {
              const href = base + p, active = p === "" ? path === base : path.startsWith(href);
              return (
                <Link key={p} href={href} aria-current={active ? "page" : undefined} className={`relative flex md:flex-col items-center gap-1.5 rounded-[9px] px-2.5 py-2 text-[0.7rem] min-w-[64px] ${active ? "bg-surface-2 text-ivory" : "text-muted hover:text-ivory"}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d={d} /></svg><span className="whitespace-nowrap">{label}</span>
                  {p === "/alerts" && open ? <span className="absolute right-1 top-1 rounded-full bg-[#E0AE52] px-1.5 text-[0.62rem] font-bold text-navy">{open}</span> : null}
                </Link>
              );
            })}
          </nav>
          <main id="main" className="flex-1 min-w-0 p-3 sm:p-5">{children}</main>
        </div>
      </div>
    </ProjectCtx.Provider>
  );
}
