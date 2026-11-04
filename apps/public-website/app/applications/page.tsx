import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { APPLICATIONS } from "@/content/applications";

export const metadata: Metadata = { title: "Applications", description: "Monitoring and analysis for concrete and embankment dams, spillways, hydropower, bridges, tunnels, buildings and other critical infrastructure." };

export default function ApplicationsPage() {
  return (
    <>
      <PageHero title="Engineering applications" crumbs={[{ href: "/applications", label: "Applications" }]}
        lead="How instrumentation, data analysis and modelling apply to different structure types — their typical concerns, instruments and analyses." />
      <section className="py-12 sm:py-16"><div className="dr-container grid gap-5 sm:grid-cols-2 lg:grid-cols-4 grid-cols-1 min-w-0">
        {APPLICATIONS.map((a) => (
          <Link key={a.slug} href={`/applications/${a.slug}`} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 hover:border-accent">
            <h2 className="font-display font-bold text-lg">{a.title}</h2>
            <p className="text-sm text-muted flex-1">{a.summary}</p>
            <span className="text-sm font-semibold text-accent-ink">Concerns, instruments, analyses →</span>
          </Link>
        ))}
      </div></section>
    </>
  );
}
