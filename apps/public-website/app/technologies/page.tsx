import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { TechnologyBrowser } from "@/components/TechnologyBrowser";

export const metadata: Metadata = {
  title: "Technologies",
  description: "Eighteen engineering technologies — from instrumentation and HST modelling to PINNs, fragility analysis and digital twins — with theory, equations and workflows.",
};

export default function TechnologiesPage() {
  return (
    <>
      <PageHero title="Engineering technologies" crumbs={[{ href: "/technologies", label: "Technologies" }]}
        lead="Each page covers engineering relevance, theory, governing equations, analytical workflow, data requirements, methods, applications, an interactive figure where useful, references and the Engineering Lab module that implements it." />
      <section className="py-12 sm:py-16"><div className="dr-container"><TechnologyBrowser /></div></section>
    </>
  );
}
