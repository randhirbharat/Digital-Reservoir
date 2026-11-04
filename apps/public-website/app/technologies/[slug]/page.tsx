import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EngineeringDisclaimer, buttonClass } from "@dr/design-system";
import { PageHero } from "@/components/PageHero";
import { References } from "@/components/References";
import { TechFigure } from "@/components/figures";
import { TECHNOLOGIES, techBySlug } from "@/content/technologies";
import { labHref, twinHref } from "@/lib/site";

export function generateStaticParams() {
  return TECHNOLOGIES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const t = techBySlug((await params).slug);
  return t ? { title: t.title, description: t.summary } : {};
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 space-y-3">
      <h2 id={`${id}-h`} className="font-display font-bold text-[1.45rem]">{title}</h2>
      {children}
    </section>
  );
}

export default async function TechnologyPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = techBySlug((await params).slug);
  if (!t) notFound();
  const idx = TECHNOLOGIES.indexOf(t);
  const prev = TECHNOLOGIES[idx - 1], next = TECHNOLOGIES[idx + 1];
  const toc = [["relevance", "Introduction & relevance"], ["theory", "Fundamental theory"], ["equations", "Governing equations"], ["workflow", "Analytical workflow"],
    ["inputs", "Input data requirements"], ["methods", "Methods & algorithms"], ["applications", "Applications"], ["figure", "Interactive figure"], ["references", "References"], ["lab", "Engineering Lab"]];
  return (
    <>
      <PageHero title={t.title} eyebrow={`${String(t.num).padStart(2, "0")} · ${t.category}`} lead={t.summary}
        crumbs={[{ href: "/technologies", label: "Technologies" }, { href: `/technologies/${t.slug}`, label: t.title }]} />
      <div className="dr-container py-12 grid gap-12 lg:grid-cols-[230px_minmax(0,1fr)] grid-cols-1 min-w-0">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 self-start min-w-0">
          <ol className="flex lg:flex-col gap-1 overflow-x-auto pb-2 text-sm">
            {toc.map(([id, label]) => <li key={id} className="shrink-0"><a href={`#${id}`} className="block rounded-lg px-3 py-2 hover:bg-surface-2">{label}</a></li>)}
          </ol>
        </nav>
        <article className="space-y-12 min-w-0 max-w-[80ch]">
          <Section id="relevance" title="Introduction and engineering relevance"><p>{t.relevance}</p></Section>
          <Section id="theory" title="Fundamental theory">{t.theory.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</Section>
          <Section id="equations" title="Governing equations">
            {t.equations.map((e) => (
              <figure key={e.label} className="m-0 space-y-1.5"><figcaption className="text-sm font-semibold text-muted">{e.label}</figcaption><div className="dr-equation" tabIndex={0} role="math" aria-label={e.body}>{e.body}</div></figure>
            ))}
          </Section>
          <Section id="workflow" title="Analytical workflow">
            <ol className="list-decimal pl-5 space-y-1.5">{t.workflow.map((w) => <li key={w}>{w}</li>)}</ol>
          </Section>
          <div className="grid gap-10 md:grid-cols-2 grid-cols-1 min-w-0">
            <Section id="inputs" title="Input data requirements"><ul className="list-disc pl-5 space-y-1.5">{t.inputs.map((x) => <li key={x}>{x}</li>)}</ul></Section>
            <Section id="methods" title="Methods and algorithms"><ul className="list-disc pl-5 space-y-1.5">{t.methods.map((x) => <li key={x}>{x}</li>)}</ul></Section>
          </div>
          <Section id="applications" title="Practical applications"><ul className="flex flex-wrap gap-2">{t.applications.map((x) => <li key={x} className="rounded-full border border-line px-3 py-1 text-sm">{x}</li>)}</ul></Section>
          <Section id="figure" title="Interactive figure"><div className="rounded-2xl border border-line bg-surface p-5"><TechFigure kind={t.figure} workflow={t.workflow} title={t.title} /></div></Section>
          <Section id="references" title="References and further reading"><References ids={t.refs} /></Section>
          <Section id="lab" title="Related Engineering Lab modules">
            <div className="flex flex-wrap gap-3">
              {t.lab.map((l) => <a key={l.label} href={l.path === "/twin" ? twinHref() : labHref(l.path)} className={buttonClass("primary")}>{l.label}</a>)}
            </div>
            <p className="text-sm text-muted">Lab modules require a free, email-verified account.</p>
          </Section>
          <EngineeringDisclaimer />
          <nav aria-label="Adjacent technologies" className="flex flex-wrap justify-between gap-4 border-t border-line pt-6 text-sm">
            {prev ? <Link href={`/technologies/${prev.slug}`} className="text-accent-ink">← {prev.title}</Link> : <span />}
            {next ? <Link href={`/technologies/${next.slug}`} className="text-accent-ink">{next.title} →</Link> : null}
          </nav>
        </article>
      </div>
    </>
  );
}
