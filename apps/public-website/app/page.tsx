import Link from "next/link";
import { buttonClass, Eyebrow, ProvenanceBadge, SectionHeading } from "@dr/design-system";
import { DamHeroIllustration, StressIllustration } from "@/components/Illustrations";
import { HstDemo } from "@/components/figures/HstDemo";
import { TECHNOLOGIES } from "@/content/technologies";
import { APPLICATIONS } from "@/content/applications";
import { ARTICLES } from "@/content/articles";
import { urls } from "@/lib/site";

const FEATURED = ["hst-modelling", "physics-informed-neural-networks", "dam-health-index", "ambient-vibration-modal-analysis", "fragility-probabilistic-assessment", "computer-vision-damage-detection"];
const FLOW = ["Physical infrastructure", "Instrumentation", "Data acquisition", "Data processing", "Statistical analysis", "AI/ML", "Hybrid modelling", "Structural health assessment", "Digital twin", "Engineering decisions"];

export default function Home() {
  const featured = FEATURED.map((s) => TECHNOLOGIES.find((t) => t.slug === s)!);
  return (
    <>
      <section className="py-14 sm:py-20 lg:py-24">
        <div className="dr-container grid gap-12 lg:grid-cols-[1.05fr_1fr] items-center grid-cols-1 min-w-0">
          <div className="space-y-6 dr-reveal">
            <Eyebrow>Engineering intelligence for dams &amp; critical infrastructure</Eyebrow>
            <h1 className="font-display font-extrabold text-[clamp(2.2rem,4.6vw+0.4rem,3.9rem)] leading-[1.04] tracking-[-0.025em]">
              Understanding Infrastructure Through Data, Physics and Intelligence.
            </h1>
            <p className="text-muted text-[clamp(1.02rem,0.6vw+0.9rem,1.2rem)] max-w-[56ch]">
              Integrating instrumentation, scientific computing, artificial intelligence and structural assessment for safer and smarter infrastructure.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/technologies" className={buttonClass("primary", "lg")}>Explore Engineering Technologies</Link>
              <a href={urls.lab} className={buttonClass("secondary", "lg", "border-ink")}>Enter Engineering Lab</a>
              <Link href="/digital-twin" className={buttonClass("ghost", "lg", "underline underline-offset-4")}>Explore Digital Twin</Link>
            </div>
          </div>
          <figure className="m-0 space-y-2">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-navy">
              <DamHeroIllustration />
              <span className="absolute left-3 top-3 rounded-full border border-bronze bg-navy/90 px-2.5 py-0.5 text-[0.62rem] font-bold tracking-[0.1em] text-[#D8C49E]">ILLUSTRATIVE · NOT AN EXISTING DAM</span>
            </div>
            <figcaption className="text-xs text-muted">Illustration. Licensed photography of real structures will be published only with permission.</figcaption>
          </figure>
        </div>
      </section>

      <section aria-label="From infrastructure to decisions" className="bg-navy text-[#E6EEEB] py-6">
        <ol className="dr-container flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-semibold">
          {FLOW.map((f, i) => (
            <li key={f} className="flex items-center gap-2">
              <span className={i === 0 || i === FLOW.length - 1 ? "text-aqua" : ""}>{f}</span>
              {i < FLOW.length - 1 ? <span aria-hidden className="text-bronze">→</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="py-16 sm:py-24">
        <div className="dr-container space-y-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Featured technologies" title="From sensor signal to engineering evidence"
              lead="Each technology page sets out theory, governing equations, workflow and data requirements, and links to the Engineering Lab module that implements it." />
            <Link href="/technologies" className="font-semibold text-accent-ink">All 18 technologies →</Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 grid-cols-1 min-w-0">
            {featured.map((t) => (
              <Link key={t.slug} href={`/technologies/${t.slug}`} className="group min-w-0 flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6 transition-colors hover:border-accent">
                <span className="font-mono text-xs text-bronze-ink">{String(t.num).padStart(2, "0")} · {t.category}</span>
                <h3 className="font-display font-bold text-xl">{t.title}</h3>
                <p className="text-muted text-[0.95rem]">{t.summary}</p>
                <span className="mt-auto font-mono text-xs text-accent-ink truncate">{t.equations[0]?.body.split("\n")[0]}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface py-16 sm:py-24">
        <div className="dr-container space-y-8">
          <SectionHeading eyebrow="Interactive analytical demonstration" title="Decompose a dam response into its HST components"
            lead="Toggle each component to see how reservoir level, season and time explain a crest-displacement record. The series is synthetic and generated in your browser." />
          <HstDemo />
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="dr-container grid gap-10 lg:grid-cols-2 items-center grid-cols-1 min-w-0">
          <figure className="m-0 space-y-2">
            <StressIllustration />
            <figcaption className="text-xs text-muted">Results from external finite-element software are imported and visualised; Digital Reservoir does not claim to run a nonlinear FE solution.</figcaption>
          </figure>
          <div className="space-y-5">
            <SectionHeading eyebrow="Numerical modelling & applications" title="Physics where it matters, data where it helps"
              lead="Visualise mesh, stress, displacement and damage from finite-element studies alongside the monitoring record of the same structure." />
            <ul className="flex flex-wrap gap-2">
              {APPLICATIONS.map((a) => (
                <li key={a.slug}><Link href={`/applications/${a.slug}`} className="inline-flex rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent">{a.title}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-navy py-16 sm:py-24 text-[#E6EEEB]" data-app="twin">
        <div className="dr-container grid gap-10 lg:grid-cols-2 items-center grid-cols-1 min-w-0">
          <div className="space-y-5">
            <div className="text-[0.72rem] font-bold tracking-[0.18em] uppercase text-aqua">Digital twin</div>
            <h2 className="font-display font-bold text-ivory text-[clamp(1.6rem,2.6vw+0.6rem,2.6rem)]">A living view of the structure, its sensors and its models</h2>
            <p className="text-[#9DB3AE] max-w-[60ch]">Sensor-to-structure mapping in 3D, live and historical instrumentation, model residuals and configurable alerts — restricted to authorised project teams.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/digital-twin" className={buttonClass("primary", "lg")}>Explore the Digital Twin</Link>
              <a href={`${urls.twin}/login`} className={buttonClass("secondary", "lg")}>Authorised login</a>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-[#0B1820] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">Demonstration gravity dam · block 7</span><ProvenanceBadge kind="simulated" /></div>
            <div className="grid gap-3 sm:grid-cols-3 grid-cols-1 min-w-0">
              {[["Reservoir level", "612.40", "m a.s.l."], ["Crest displ. PL-01", "3.81", "mm"], ["Seepage V-02", "12.4", "L/s"]].map(([l, v, u]) => (
                <div key={l} className="rounded-xl border border-line bg-surface p-3"><div className="text-xs text-muted">{l}</div><div className="font-mono text-lg">{v} <span className="text-xs text-muted">{u}</span></div></div>
              ))}
            </div>
            <p className="text-xs text-muted">Values from the demonstration simulator. They do not describe any real structure.</p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="dr-container space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Research and insights" title="Methods explained, evidence cited" />
            <Link href="/research" className="font-semibold text-accent-ink">All articles →</Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3 grid-cols-1 min-w-0">
            {ARTICLES.slice(0, 3).map((a) => (
              <Link key={a.slug} href={`/research/${a.slug}`} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface hover:border-accent">
                <div className="aspect-[3/2] bg-sage flex items-center justify-center" aria-hidden>
                  <svg viewBox="0 0 200 100" width="70%"><polyline points="0,70 30,60 60,66 90,40 120,48 150,28 200,34" fill="none" stroke="#183C45" strokeWidth="3" /><path d="M120 0V100" stroke="#9B8461" strokeDasharray="4 4" /></svg>
                </div>
                <div className="p-5 space-y-2">
                  <div className="text-xs font-bold tracking-[0.12em] uppercase text-bronze-ink">{a.type}</div>
                  <h3 className="font-display font-bold text-lg leading-snug">{a.title}</h3>
                  <p className="text-sm text-muted">{a.summary}</p>
                </div>
              </Link>
            ))}
          </div>
          <p className="text-sm text-muted">Digital Reservoir publications are listed on the <Link href="/publications" className="underline">Publications</Link> page once verified bibliographic records are added.</p>
        </div>
      </section>

      <section className="bg-sage py-16 sm:py-20">
        <div className="dr-container flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-[60ch] space-y-3">
            <Eyebrow>Collaboration</Eyebrow>
            <h2 className="font-display font-bold text-[clamp(1.6rem,2.6vw+0.6rem,2.4rem)]">Research partnerships, pilot projects and data collaborations</h2>
            <p className="text-[#3D4D53]">Institutions, dam owners and engineering teams can propose a project. We reply with a scoped technical note — never a safety verdict by email.</p>
          </div>
          <Link href="/contact" className={buttonClass("primary", "lg")}>Start a conversation</Link>
        </div>
      </section>
    </>
  );
}
