import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ResearchBrowser } from "@/components/ResearchBrowser";

export const metadata: Metadata = { title: "Research and Insights", description: "Technical articles, tutorials, methodologies and technical comparisons on dam monitoring, HST, machine learning and structural health monitoring." };

export default function ResearchPage() {
  return (
    <>
      <PageHero title="Research and insights" crumbs={[{ href: "/research", label: "Research and Insights" }]}
        lead="Technical articles, tutorials, methodologies and comparisons. Case studies, literature reviews and conference contributions will be added as they are completed and reviewed." />
      <section className="py-12 sm:py-16"><div className="dr-container"><ResearchBrowser /></div></section>
    </>
  );
}
