"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TECHNOLOGIES, TECH_CATEGORIES } from "@/content/technologies";

const STATUS_LABEL = { available: "Lab module available", partial: "Partly implemented", planned: "Planned (Stage 6)" } as const;

export function TechnologyBrowser() {
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return TECHNOLOGIES.filter((t) => (cat === "All" || t.category === cat) &&
      (!s || `${t.title} ${t.summary} ${t.methods.join(" ")}`.toLowerCase().includes(s)));
  }, [cat, q]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
          {["All", ...TECH_CATEGORIES].map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}
              className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${cat === c ? "bg-accent text-on-accent border-accent" : "bg-surface border-line hover:border-accent"}`}>{c}</button>
          ))}
        </div>
        <label className="flex min-h-[44px] flex-1 sm:flex-none sm:w-80 items-center gap-2 rounded-[10px] border border-line bg-surface px-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="text-muted"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <span className="sr-only">Search technologies</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search technologies and methods" className="w-full bg-transparent outline-none" />
        </label>
      </div>
      <p className="text-sm text-muted" aria-live="polite">Showing {list.length} of {TECHNOLOGIES.length} technologies</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 grid-cols-1 min-w-0">
        {list.map((t) => (
          <Link key={t.slug} href={`/technologies/${t.slug}`} className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-5 hover:border-accent">
            <div className="flex justify-between gap-2 text-xs"><span className="font-mono text-bronze-ink">{String(t.num).padStart(2, "0")}</span><span className="font-bold tracking-[0.08em] uppercase text-accent-ink">{t.category}</span></div>
            <h2 className="font-display font-bold text-lg leading-snug">{t.title}</h2>
            <p className="text-sm text-muted flex-1">{t.summary}</p>
            <span className="text-xs text-muted">{STATUS_LABEL[t.status]}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
