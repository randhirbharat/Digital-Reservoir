/* Original Digital Reservoir articles. Each section is { h?: heading, p?: paragraph, list?: items, eq?: equation }. */
export interface ArticleBlock { h?: string; p?: string; list?: string[]; eq?: string }
export interface Article {
  slug: string;
  title: string;
  type: "Tutorial" | "Methodology" | "Technical comparison" | "Research development";
  subject: string;
  date: string; // ISO
  summary: string;
  readingMinutes: number;
  body: ArticleBlock[];
  refs: string[];
}

export const ARTICLES: Article[] = [
  {
    slug: "calibration-fit-is-not-forecast-skill",
    title: "Calibration fit is not forecast skill: chronological validation for monitoring models",
    type: "Tutorial", subject: "Validation", date: "2026-10-20", readingMinutes: 7,
    summary: "Why random train/test splits overstate the accuracy of dam behaviour models, and how chronological, rolling-origin and frozen-holdout evaluation give an honest picture.",
    body: [
      { p: "A behaviour model that reproduces its calibration data closely is not necessarily a good predictor. Monitoring series are strongly autocorrelated: tomorrow's pendulum reading is very close to today's. If observations are shuffled before splitting into training and test sets, almost every test point has a near-duplicate neighbour in the training set, and the test error measures interpolation, not prediction." },
      { h: "Three honest schemes" },
      { list: [
        "Chronological holdout — calibrate on the earliest part of the record, validate on the most recent part. Simple and easy to explain; one estimate only.",
        "Rolling-origin evaluation — repeatedly extend the calibration window and predict the next block. Gives several estimates and shows how skill evolves with record length.",
        "Frozen test period — lock the final months before any model selection begins, and evaluate the chosen model only once at the end.",
      ] },
      { h: "Leakage hides in preprocessing" },
      { p: "Scalers, imputers, lag features and term selection must be fitted on calibration data only. Standardising with the mean of the whole record, or choosing polynomial degree by looking at validation error, leaks information from the future." },
      { h: "Report both, rank on one" },
      { p: "Report calibration and validation metrics side by side, but rank models only on validation performance. A large gap between them is a symptom of over-fitting, especially for flexible machine-learning models." },
      { eq: "RMSE_validation ≫ RMSE_calibration  →  model memorises rather than generalises" },
      { p: "The Engineering Lab enforces chronological splits for time-indexed data and labels every metric with the period it was computed on." },
    ],
    refs: ["tashman2000", "bergmeir2012", "salazar2017"],
  },
  {
    slug: "building-a-defensible-dam-health-index",
    title: "Building a dam health index you can defend: indicators, AHP weights and uncertainty",
    type: "Methodology", subject: "Health index", date: "2026-10-06", readingMinutes: 8,
    summary: "A traceable route from instrument readings to a composite index — and why default weights must never be presented as validated criteria.",
    body: [
      { p: "Composite indices are attractive because they summarise many indicators in one number. They are also dangerous for the same reason: weights and thresholds embody judgement, and a single number can hide it." },
      { h: "1. Indicators with a reason" },
      { p: "Each indicator should be linked to a failure mode or performance requirement: for example, the HST residual of crest displacement, the trend of foundation uplift, drain efficiency or seepage rate." },
      { h: "2. Normalisation against project references" },
      { p: "Indicators are mapped to a 0–1 scale using reference values specific to the structure — design values, historical envelopes or regulatory limits — and the choice is recorded." },
      { h: "3. Weights with a consistency check" },
      { p: "The Analytic Hierarchy Process derives weights from pairwise comparisons and computes a consistency ratio. A ratio above about 0.10 indicates contradictory judgements to revisit." },
      { eq: "CR = (λ_max − n) / ((n − 1) · RI)" },
      { h: "4. Sensitivity and uncertainty" },
      { p: "Vary each weight and normalisation bound, and propagate measurement uncertainty. If the condition class changes under plausible variations, report that instability rather than a single class." },
      { h: "5. Interpretation" },
      { p: "The index supports prioritisation and communication; it does not replace inspection, analysis or the judgement of the responsible engineer." },
    ],
    refs: ["saaty1980"],
  },
  {
    slug: "hst-in-practice",
    title: "HST in practice: choosing terms, reading coefficients and watching residuals",
    type: "Tutorial", subject: "HST", date: "2026-09-15", readingMinutes: 9,
    summary: "A practical walk-through of the Hydrostatic–Season–Time model, from normalising reservoir level to interpreting standardised residuals.",
    body: [
      { p: "The HST model has survived for decades because it is simple, interpretable and usually good enough to separate the main loading effects in concrete dams." },
      { h: "Normalise the reservoir level" },
      { eq: "h = (H_max − H) / (H_max − H_min)" },
      { p: "Normalisation keeps polynomial terms well conditioned. Fourth-order polynomials are common, but higher order is not always better: check whether added terms reduce validation error." },
      { h: "Seasonal harmonics are a proxy" },
      { p: "Sine and cosine of the day of year stand in for the thermal cycle. They assume the cycle repeats each year; unusual years (heat waves, prolonged cold) appear in the residuals. Where temperatures are measured, consider an HTT formulation." },
      { h: "Time terms describe, they do not explain" },
      { p: "Linear, exponential or logarithmic time functions capture irreversible trends such as creep or swelling. Their extrapolation is speculative; treat a growing time component as a prompt for investigation." },
      { h: "Watch standardised residuals" },
      { p: "Residuals divided by the validation standard deviation give a comparable scale across instruments. Persistent excursions, trends or changed variance are more informative than single exceedances." },
    ],
    refs: ["willm1967", "leger2007", "mata2011"],
  },
  {
    slug: "environmental-normalisation-of-modal-frequencies",
    title: "Separating temperature and water level from damage in modal frequency tracking",
    type: "Technical comparison", subject: "Modal analysis", date: "2026-08-28", readingMinutes: 6,
    summary: "Natural frequencies of dams change with reservoir level and temperature far more than with moderate damage. Comparing regression, PCA and residual approaches for normalisation.",
    body: [
      { p: "For concrete dams, the added mass of the reservoir lowers natural frequencies as the water rises; temperature changes stiffness and joint closure. These effects can exceed the frequency shift caused by moderate damage." },
      { h: "Three normalisation approaches" },
      { list: [
        "Regression on measured environmental variables — transparent, requires good covariates.",
        "PCA on multiple frequencies — removes shared environmental variability without explicit covariates, but may also remove damage if it affects all modes similarly.",
        "Residual monitoring — monitor the difference between identified frequencies and a model of their environmental dependence.",
      ] },
      { p: "Whichever approach is used, novelty thresholds should be calibrated on a baseline period that covers the full range of operating conditions." },
    ],
    refs: ["brincker2015", "farrar2012", "jolliffe2002"],
  },
];

export const articleBySlug = (s: string) => ARTICLES.find((a) => a.slug === s);
