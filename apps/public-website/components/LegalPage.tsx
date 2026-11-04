import { PageHero } from "./PageHero";
export function LegalPage({ title, href, sections, note }: { title: string; href: string; sections: [string, string[]][]; note: string }) {
  return (
    <>
      <PageHero title={title} crumbs={[{ href, label: title }]} />
      <div className="dr-container py-12"><div className="dr-prose">
        <p className="rounded-lg border border-cond-attention/50 bg-cond-attention/10 p-3 text-sm">{note}</p>
        {sections.map(([h, ps]) => <div key={h}><h2>{h}</h2>{ps.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}</div>)}
      </div></div>
    </>
  );
}
