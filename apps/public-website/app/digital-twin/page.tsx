import type { Metadata } from "next";
import { buttonClass, EngineeringDisclaimer } from "@dr/design-system";
import { PageHero } from "@/components/PageHero";
import { urls } from "@/lib/site";

export const metadata: Metadata = { title: "Digital Twin", description: "A secure, project-based digital twin environment linking structures, sensors, live data and analytical models." };

const PARTS = [
  ["Sensor-to-structure mapping", "Every sensor is linked to its component, coordinates, variable, unit, calibration and data source. Click a sensor in 3D to see its latest value and trend."],
  ["Live and historical monitoring", "Streaming charts with selectable refresh, time windows, threshold lines, quality flags and historical replay."],
  ["Integrated analytics", "HST and ML predictions published from the Engineering Lab, with model version, calibration and validation periods."],
  ["Alerts with review", "Threshold, missing-data and model-deviation alerts with acknowledgement and closure — never presented as safety determinations."],
  ["Data provenance", "Live, historical, simulated and imported data are always labelled. Demonstrations use a clearly marked simulator."],
  ["Security", "Invitation or approval per project, multi-factor authentication, project-level isolation and audit trails."],
];

export default function TwinLanding() {
  return (
    <>
      <PageHero title="Digital Twin" eyebrow="Application 03 · authorised projects"
        lead="A continuously updating digital representation that connects physical structures, instrumentation, data quality and engineering models.">
        <div className="flex flex-wrap gap-3 pt-2">
          <a href={`${urls.twin}/login`} className={buttonClass("primary", "lg")}>Authorised login</a>
          <a href="/contact" className={buttonClass("secondary", "lg", "text-ivory border-[#9DB3AE]")}>Request project access</a>
        </div>
      </PageHero>
      <div className="dr-container py-12 space-y-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 grid-cols-1 min-w-0">
          {PARTS.map(([t, d]) => (
            <section key={t} className="rounded-[var(--radius-card)] border border-line bg-surface p-5"><h2 className="font-display font-bold text-lg">{t}</h2><p className="text-sm text-muted mt-2">{d}</p></section>
          ))}
        </div>
        <p className="text-sm text-muted">Access is granted per project by invitation or administrator approval. Membership of one project never grants access to another. Operational infrastructure information is treated as sensitive and is not indexed by search engines.</p>
        <EngineeringDisclaimer />
      </div>
    </>
  );
}
