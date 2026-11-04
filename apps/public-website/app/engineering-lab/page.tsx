import type { Metadata } from "next";
import { buttonClass, EngineeringDisclaimer } from "@dr/design-system";
import { PageHero } from "@/components/PageHero";
import { labHref } from "@/lib/site";

export const metadata: Metadata = { title: "Engineering Lab", description: "A registration-based web laboratory for monitoring-data processing, statistics, HST, PCA and machine learning." };

const MODULES = [
  ["Data management", "CSV/Excel upload, validation, preview, missing data, duplicates, outliers, resampling — originals preserved, versions tracked."],
  ["Signal processing", "Baseline correction, detrending, moving average, Butterworth filters, FFT, Welch PSD, wavelets and seasonal decomposition."],
  ["Statistics & PCA", "Descriptive statistics, correlation, multiple/polynomial regression with diagnostics, ACF/PACF, PCA."],
  ["HST analysis", "Hydrostatic–season–time models with chronological validation, prediction intervals and component plots."],
  ["ML laboratory", "Linear, Ridge, Lasso, SVR, KNN, trees, random forest, gradient boosting, XGBoost — compared on identical time-respecting splits."],
  ["Damage detection & DHI", "Residual and multivariate anomaly detection, change points, and a configurable, documented Dam Health Index."],
];

export default function LabLanding() {
  return (
    <>
      <PageHero title="Engineering Lab" eyebrow="Application 02 · registered members"
        lead="Upload monitoring data, process signals, build statistical and machine-learning models, and export results and reports — in the browser, with computation on the server.">
        <div className="flex flex-wrap gap-3 pt-2">
          <a href={labHref("/register")} className={buttonClass("primary", "lg")}>Create a free account</a>
          <a href={labHref("/login")} className={buttonClass("secondary", "lg", "text-ivory border-[#9DB3AE]")}>Sign in</a>
        </div>
      </PageHero>
      <div className="dr-container py-12 space-y-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 grid-cols-1 min-w-0">
          {MODULES.map(([t, d]) => (
            <section key={t} className="rounded-[var(--radius-card)] border border-line bg-surface p-5"><h2 className="font-display font-bold text-lg">{t}</h2><p className="text-sm text-muted mt-2">{d}</p></section>
          ))}
        </div>
        <section className="grid gap-6 md:grid-cols-3 grid-cols-1 min-w-0">
          {[["1. Register", "Choose a membership category: general member, student, researcher or professional member."], ["2. Verify your email", "Analytical modules unlock after verification. Sessions expire after inactivity."], ["3. Work in projects", "Projects keep datasets, analyses and reports together; you can save, reopen and export them."]].map(([t, d]) => (
            <div key={t}><h3 className="font-semibold">{t}</h3><p className="text-sm text-muted">{d}</p></div>
          ))}
        </section>
        <EngineeringDisclaimer />
      </div>
    </>
  );
}
