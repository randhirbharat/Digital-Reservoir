import Link from "next/link";
import type { ReactNode } from "react";

export function PageHero({ title, lead, crumbs, eyebrow, children }: {
  title: string; lead?: ReactNode; crumbs?: { href: string; label: string }[]; eyebrow?: string; children?: ReactNode;
}) {
  return (
    <section className="bg-navy text-[#E6EEEB]">
      <div className="dr-container py-12 sm:py-16 space-y-4">
        {crumbs ? (
          <nav aria-label="Breadcrumb" className="text-sm text-[#9DB3AE]">
            <ol className="flex flex-wrap gap-1.5">
              <li><Link href="/" className="hover:text-aqua">Home</Link></li>
              {crumbs.map((c) => (
                <li key={c.href} className="flex gap-1.5"><span aria-hidden>/</span><Link href={c.href} className="hover:text-aqua">{c.label}</Link></li>
              ))}
            </ol>
          </nav>
        ) : null}
        {eyebrow ? <div className="text-[0.72rem] font-bold tracking-[0.18em] uppercase text-aqua">{eyebrow}</div> : null}
        <h1 className="font-display font-extrabold text-ivory text-[clamp(2rem,4vw+0.5rem,3.3rem)] leading-[1.06] max-w-[24ch]">{title}</h1>
        {lead ? <p className="text-[#B7CBC6] text-[clamp(1rem,0.6vw+0.9rem,1.15rem)] max-w-[64ch]">{lead}</p> : null}
        {children}
      </div>
    </section>
  );
}
