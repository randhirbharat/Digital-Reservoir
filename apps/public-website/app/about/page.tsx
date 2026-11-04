import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = { title: "About", description: "Digital Reservoir connects field engineering, monitoring systems, data intelligence and professional judgement for critical infrastructure." };

const VALUES = [["Safety first", "We prioritise people, communities and responsible engineering practice."], ["Engineering integrity", "We state assumptions, limitations and evidence honestly."], ["Data quality", "Traceable, calibrated and validated data are essential to reliable interpretation."], ["Transparency", "Models and dashboards should be explainable and reviewable."], ["Practical innovation", "We use technology where it provides a genuine engineering benefit."], ["Long-term thinking", "We consider asset life, monitoring continuity, maintenance and resilience."]];

export default function AboutPage() {
  return (
    <>
      <PageHero title="About Digital Reservoir" crumbs={[{ href: "/about", label: "About" }]}
        lead="We connect field engineering, monitoring systems, data intelligence and professional judgement to improve the safety, reliability and service life of critical infrastructure." />
      <div className="dr-container py-12 grid gap-12 lg:grid-cols-2 grid-cols-1 min-w-0">
        <div className="dr-prose">
          <h2>Why Digital Reservoir</h2>
          <p>Monitoring is valuable when it leads to understanding. Infrastructure interacts continuously with water, temperature, operation, ageing, ground conditions and extreme events. Digital Reservoir helps owners and researchers move from isolated readings to an integrated understanding of asset behaviour.</p>
          <h2>Mission</h2>
          <p>To transform field observations and monitoring data into clear, timely and traceable engineering evidence.</p>
          <h2>Research interests</h2>
          <ul><li>Behaviour models for concrete and embankment dams</li><li>Hybrid physics–data modelling and physics-informed learning</li><li>Quantitative condition indices with documented uncertainty</li><li>Seismic performance and fragility of dams</li><li>Digital twins for infrastructure surveillance</li></ul>
          <h2>Institutional collaboration</h2>
          <p>We welcome collaboration with universities, research institutes, dam owners and engineering organisations on research projects, pilot deployments and data-sharing agreements with appropriate confidentiality.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 content-start grid-cols-1 min-w-0">
          {VALUES.map(([t, d]) => <section key={t} className="rounded-[var(--radius-card)] border border-line bg-surface p-5"><h3 className="font-semibold">{t}</h3><p className="text-sm text-muted mt-1">{d}</p></section>)}
        </div>
      </div>
    </>
  );
}
