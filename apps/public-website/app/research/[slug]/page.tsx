import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { References } from "@/components/References";
import { ARTICLES, articleBySlug } from "@/content/articles";

export function generateStaticParams() { return ARTICLES.map((a) => ({ slug: a.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = articleBySlug((await params).slug);
  return a ? { title: a.title, description: a.summary, openGraph: { type: "article", title: a.title, description: a.summary, publishedTime: a.date } } : {};
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = articleBySlug((await params).slug);
  if (!a) notFound();
  return (
    <>
      <PageHero title={a.title} eyebrow={`${a.type} · ${a.subject}`} lead={a.summary}
        crumbs={[{ href: "/research", label: "Research and Insights" }, { href: `/research/${a.slug}`, label: a.type }]}>
        <p className="text-sm text-[#9DB3AE]"><time dateTime={a.date}>{new Date(a.date).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</time> · {a.readingMinutes} min read · Digital Reservoir</p>
      </PageHero>
      <article className="dr-container py-12">
        <div className="dr-prose">
          {a.body.map((b, i) => (
            <div key={i}>
              {b.h ? <h2>{b.h}</h2> : null}
              {b.p ? <p>{b.p}</p> : null}
              {b.list ? <ul>{b.list.map((l) => <li key={l}>{l}</li>)}</ul> : null}
              {b.eq ? <div className="dr-equation my-4" tabIndex={0}>{b.eq}</div> : null}
            </div>
          ))}
          <h2>References</h2>
        </div>
        <div className="max-w-[72ch] mt-2"><References ids={a.refs} /></div>
        <p className="mt-10"><Link href="/research" className="text-accent-ink">← All articles</Link></p>
      </article>
    </>
  );
}
