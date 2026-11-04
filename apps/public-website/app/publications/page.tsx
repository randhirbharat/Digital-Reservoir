import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { PublicationsBrowser } from "@/components/PublicationsBrowser";

export const metadata: Metadata = { title: "Publications", description: "Digital Reservoir publications and the foundational literature behind its methods, filterable by type, subject, period, author and journal." };

export default function PublicationsPage() {
  return (
    <>
      <PageHero title="Publications" crumbs={[{ href: "/publications", label: "Publications" }]}
        lead="Filter by publication type, subject, period, author and journal. Bibliographic details of external works should be verified with the publisher before citation." />
      <section className="py-12 sm:py-16"><div className="dr-container"><PublicationsBrowser own={[]} /></div></section>
    </>
  );
}
