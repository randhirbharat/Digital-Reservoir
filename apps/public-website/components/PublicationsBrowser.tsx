"use client";
import { useMemo, useState } from "react";
import { REFERENCES, formatReference, type Reference } from "@/content/references";

export function PublicationsBrowser({ own }: { own: Reference[] }) {
  const all = REFERENCES;
  const [type, setType] = useState("All"), [subject, setSubject] = useState("All"), [year, setYear] = useState("All"), [author, setAuthor] = useState(""), [q, setQ] = useState("");
  const subjects = useMemo(() => Array.from(new Set(all.flatMap((r) => r.subjects))).sort(), [all]);
  const decades = useMemo(() => Array.from(new Set(all.map((r) => `${Math.floor(r.year / 10) * 10}s`))).sort().reverse(), [all]);
  const list = useMemo(() => all.filter((r) =>
    (type === "All" || r.type === type) && (subject === "All" || r.subjects.includes(subject)) &&
    (year === "All" || `${Math.floor(r.year / 10) * 10}s` === year) &&
    (!author || r.authors.toLowerCase().includes(author.toLowerCase())) &&
    (!q || `${r.title} ${r.venue}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.year - a.year), [all, type, subject, year, author, q]);
  const sel = "min-h-[44px] rounded-[10px] border border-line bg-surface px-3 w-full";
  return (
    <div className="space-y-8">
      <section aria-labelledby="own-h" className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-2">
        <h2 id="own-h" className="font-display font-bold text-xl">Digital Reservoir publications</h2>
        {own.length ? null : <p className="text-muted">No publications are listed yet. Entries are added only from verified bibliographic records (authors, venue, year, DOI) with abstracts and keywords, and documents are offered for download only where sharing is authorised.</p>}
      </section>
      <section aria-labelledby="ref-h" className="space-y-4">
        <h2 id="ref-h" className="font-display font-bold text-xl">Foundational external literature</h2>
        <p className="text-sm text-muted">Works by other authors that underpin the methods used on this platform. Not Digital Reservoir publications.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 grid-cols-1 min-w-0">
          <label className="text-sm font-semibold text-muted">Type<select className={sel} value={type} onChange={(e) => setType(e.target.value)}><option>All</option><option value="journal">Journal article</option><option value="book">Book</option><option value="conference">Conference paper</option></select></label>
          <label className="text-sm font-semibold text-muted">Subject<select className={sel} value={subject} onChange={(e) => setSubject(e.target.value)}><option>All</option>{subjects.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="text-sm font-semibold text-muted">Period<select className={sel} value={year} onChange={(e) => setYear(e.target.value)}><option>All</option>{decades.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label className="text-sm font-semibold text-muted">Author<input className={sel} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. Chopra" /></label>
          <label className="text-sm font-semibold text-muted">Title / journal<input className={sel} value={q} onChange={(e) => setQ(e.target.value)} placeholder="keyword" /></label>
        </div>
        <p className="text-sm text-muted" aria-live="polite">{list.length} of {all.length} entries</p>
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {list.map((r) => (
            <li key={r.id} className="p-4 space-y-1">
              <div className="text-[0.95rem]">{formatReference(r)}</div>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <span className="rounded-full bg-surface-2 px-2 py-0.5">{r.type}</span>
                {r.subjects.map((s) => <span key={s} className="rounded-full border border-line px-2 py-0.5">{s}</span>)}
                {r.doi ? <a className="text-accent-ink underline" href={`https://doi.org/${r.doi}`} rel="noopener noreferrer">doi:{r.doi}</a> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
