"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ARTICLES } from "@/content/articles";

export function ResearchBrowser() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const types = ["All", ...Array.from(new Set(ARTICLES.map((a) => a.type)))];
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ARTICLES.filter((a) => (type === "All" || a.type === type) &&
      (!s || [a.title, a.summary, a.subject, ...a.body.map((b) => `${b.h ?? ""} ${b.p ?? ""} ${(b.list ?? []).join(" ")}`)].join(" ").toLowerCase().includes(s)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [q, type]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div role="group" aria-label="Article type" className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}
              className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${type === t ? "bg-accent text-on-accent border-accent" : "bg-surface border-line"}`}>{t}</button>
          ))}
        </div>
        <label className="flex min-h-[44px] w-full sm:w-80 items-center gap-2 rounded-[10px] border border-line bg-surface px-3">
          <span className="sr-only">Search articles</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search full text of articles" className="w-full bg-transparent outline-none" />
        </label>
      </div>
      <p className="text-sm text-muted" aria-live="polite">{list.length} article{list.length === 1 ? "" : "s"}</p>
      <div className="grid gap-5 md:grid-cols-2 grid-cols-1 min-w-0">
        {list.map((a) => (
          <Link key={a.slug} href={`/research/${a.slug}`} className="rounded-[var(--radius-card)] border border-line bg-surface p-6 hover:border-accent space-y-2">
            <div className="flex flex-wrap gap-x-3 text-xs"><span className="font-bold tracking-[0.12em] uppercase text-bronze-ink">{a.type}</span><span className="text-muted">{a.subject} · {new Date(a.date).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })} · {a.readingMinutes} min</span></div>
            <h2 className="font-display font-bold text-xl leading-snug">{a.title}</h2>
            <p className="text-sm text-muted">{a.summary}</p>
          </Link>
        ))}
        {!list.length ? <p className="text-muted">No articles match. Try a broader term.</p> : null}
      </div>
    </div>
  );
}
