"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo, buttonClass } from "@dr/design-system";
import { NAV, urls } from "@/lib/site";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/85">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:rounded-md">
        Skip to content
      </a>
      <div className="hidden xl:block border-b border-line bg-navy text-[#DCE9E4]">
        <div className="dr-container flex min-h-[40px] items-center justify-end gap-5 text-[0.82rem] font-semibold">
          <span className="mr-auto text-[#9DB3AE] font-normal">Intelligence for Infrastructure</span>
          <a href={`${urls.lab}/login`} className="inline-flex items-center gap-2 hover:text-aqua">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 3h10v18H9" /><path d="M3 12h11" /><path d="M10 8l4 4-4 4" /></svg>
            Engineering Lab — login / register</a>
          <a href={`${urls.twin}/login`} className="inline-flex items-center gap-2 rounded-md border border-[#9DB3AE]/50 px-2.5 py-1 hover:text-aqua hover:border-aqua">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            Digital Twin login</a>
        </div>
      </div>
      <div className="dr-container flex min-h-[72px] items-center justify-between gap-4">
        <Link href="/" aria-label="Digital Reservoir home" className="shrink-0">
          <Logo size={38} tagline={false} />
        </Link>
        <nav aria-label="Main" className="hidden xl:flex items-center gap-0.5 text-[0.86rem] font-medium">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(pathname, n.href) ? "page" : undefined}
              className={`rounded-lg px-2 py-2 transition-colors whitespace-nowrap ${isActive(pathname, n.href) ? "bg-surface-2 text-ink" : "text-ink/85 hover:text-ink hover:bg-surface-2/60"}`}
            >
              {n.label === "Research and Insights" ? "Research" : n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 xl:hidden">
          <div className="hidden md:flex gap-2">
            <a href={`${urls.lab}/login`} className={buttonClass("primary", "sm", "min-h-[42px]")}>Lab login / register</a>
            <a href={`${urls.twin}/login`} className={buttonClass("secondary", "sm", "min-h-[42px] border-ink")}>Digital Twin login</a>
          </div>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-[10px] border border-line bg-surface"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-menu" aria-label="Main (mobile)" className="xl:hidden border-t border-line bg-bg">
          <div className="dr-container flex flex-col py-3">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined}
                className={`py-3 px-2 rounded-lg ${isActive(pathname, n.href) ? "font-semibold bg-surface-2" : ""}`}>
                {n.label}
              </Link>
            ))}
            <div className="grid gap-2 pt-3 pb-2 md:hidden grid-cols-1 min-w-0">
              <a href={`${urls.lab}/login`} className={buttonClass("primary", "lg")}>Engineering Lab — login / register</a>
              <a href={`${urls.twin}/login`} className={buttonClass("secondary", "lg", "border-ink")}>Digital Twin — authorised login</a>
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
