import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { APPLICATIONS, applicationBySlug } from "@/content/applications";
import { techBySlug } from "@/content/technologies";

export function generateStaticParams() { return APPLICATIONS.map((a) => ({ slug: a.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = applicationBySlug((await params).slug); return a ? { title: a.title, description: a.summary } : {};
}

export default async function ApplicationPage({ params }: { params: Promise<{ slug: string }> }) {
  const a = applicationBySlug((await params).slug);
  if (!a) notFound();
  const cols: [string, string[]][] = [["Typical engineering concerns", a.concerns], ["Typical instrumentation", a.instruments], ["Analyses supported", a.analyses]];
  return (
    <>
      <PageHero title={a.title} lead={a.summary} crumbs={[{ href: "/applications", label: "Applications" }, { href: `/applications/${a.slug}`, label: a.title }]} />
      <div className="dr-container py-12 space-y-12">
        <div className="grid gap-6 md:grid-cols-3 grid-cols-1 min-w-0">
          {cols.map(([title, items]) => (
            <section key={title} className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
              <h2 className="font-display font-bold text-lg mb-3">{title}</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-[0.95rem]">{items.map((i) => <li key={i}>{i}</li>)}</ul>
            </section>
          ))}
        </div>
        <section className="space-y-4">
          <h2 className="font-display font-bold text-xl">Related technologies</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 grid-cols-1 min-w-0">
            {a.techSlugs.map(techBySlug).filter(Boolean).map((t) => (
              <Link key={t!.slug} href={`/technologies/${t!.slug}`} className="rounded-xl border border-line bg-surface p-4 hover:border-accent">
                <div className="font-semibold">{t!.title}</div><div className="text-sm text-muted mt-1">{t!.summary}</div>
              </Link>
            ))}
          </div>
        </section>
        <p className="text-sm text-muted">Every structure is different: instrument choices and analyses must follow a project-specific failure-mode review and applicable regulations.</p>
      </div>
    </>
  );
}
