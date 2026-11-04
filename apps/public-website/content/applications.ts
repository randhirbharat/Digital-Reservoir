export interface Application {
  slug: string;
  title: string;
  summary: string;
  concerns: string[];
  instruments: string[];
  analyses: string[];
  techSlugs: string[];
}

export const APPLICATIONS: Application[] = [
  {
    slug: "concrete-gravity-dams", title: "Concrete gravity dams",
    summary: "Mass-concrete structures resisting water load by self-weight; behaviour is dominated by hydrostatic load, the thermal cycle and foundation conditions.",
    concerns: ["Uplift and foundation drainage efficiency", "Sliding along lift joints and the dam–foundation interface", "Thermal cracking and joint opening", "Alkali–aggregate reaction and long-term swelling"],
    instruments: ["Plumb lines and pendulums", "Uplift piezometers", "Joint meters", "Seepage weirs", "Embedded thermometers", "Geodetic targets"],
    analyses: ["HST / HTT behaviour models", "Residual-based anomaly screening", "Modal tracking", "Seismic and fragility analysis"],
    techSlugs: ["hst-modelling", "structural-health-monitoring", "ambient-vibration-modal-analysis", "fragility-probabilistic-assessment"],
  },
  {
    slug: "embankment-dams", title: "Embankment dams",
    summary: "Earth and rockfill dams where seepage, pore pressure and deformation govern safety.",
    concerns: ["Internal erosion and piping", "Pore-pressure build-up", "Settlement and crest deformation", "Slope stability under drawdown and earthquake"],
    instruments: ["Standpipe and vibrating-wire piezometers", "Settlement cells", "Inclinometers", "Seepage weirs with turbidity", "GNSS"],
    analyses: ["Piezometric response to reservoir level (lag models)", "Seepage trend analysis", "PCA of piezometer arrays", "Change-point detection"],
    techSlugs: ["statistical-analysis-regression", "structural-health-monitoring", "signal-processing-data-quality"],
  },
  {
    slug: "spillways-hydraulic-structures", title: "Spillways and hydraulic structures",
    summary: "Chutes, gates and energy dissipators subject to high-velocity flow, cavitation and vibration.",
    concerns: ["Cavitation and abrasion", "Uplift under chute slabs", "Gate vibration", "Joint and drain performance"],
    instruments: ["Pressure transducers", "Accelerometers", "Drain flow meters", "Inspection imagery"],
    analyses: ["Spectral vibration analysis", "Image-based damage mapping", "Uplift trend analysis"],
    techSlugs: ["signal-processing-data-quality", "computer-vision-damage-detection", "ambient-vibration-modal-analysis"],
  },
  {
    slug: "hydropower-infrastructure", title: "Hydropower infrastructure",
    summary: "Intakes, penstocks, powerhouses and tunnels operating under cyclic hydraulic loads.",
    concerns: ["Penstock fatigue and transients", "Powerhouse vibration", "Tunnel lining condition"],
    instruments: ["Strain gauges", "Pressure sensors", "Accelerometers", "Convergence measurements"],
    analyses: ["Operational modal analysis", "Fatigue-oriented signal analysis", "Anomaly detection"],
    techSlugs: ["ambient-vibration-modal-analysis", "structural-health-monitoring", "data-acquisition-sensor-networks"],
  },
  {
    slug: "bridges-flyovers", title: "Bridges and flyovers",
    summary: "Structures where traffic, temperature and ageing interact; modal and strain monitoring are central.",
    concerns: ["Bearing and joint function", "Fatigue in steel details", "Scour at foundations", "Prestress losses"],
    instruments: ["Accelerometers", "Strain gauges", "Displacement transducers", "Weather stations"],
    analyses: ["Temperature-normalised frequency tracking", "Influence-line identification", "Novelty detection"],
    techSlugs: ["ambient-vibration-modal-analysis", "structural-health-monitoring", "artificial-intelligence-machine-learning"],
  },
  {
    slug: "tunnels", title: "Tunnels",
    summary: "Underground structures where ground–lining interaction and water ingress govern performance.",
    concerns: ["Convergence", "Lining cracking", "Water ingress", "Ground movement during construction"],
    instruments: ["Convergence targets", "Strain gauges in segments", "Piezometers", "Laser scanning"],
    analyses: ["Trend and change-point analysis", "Image-based crack mapping", "Finite-element back-analysis"],
    techSlugs: ["computer-vision-damage-detection", "numerical-finite-element-modelling", "structural-health-monitoring"],
  },
  {
    slug: "buildings", title: "Buildings",
    summary: "Tall and critical buildings monitored for dynamic properties and settlement.",
    concerns: ["Seismic performance", "Differential settlement", "Wind-induced vibration"],
    instruments: ["Accelerometers", "Tiltmeters", "Settlement points"],
    analyses: ["Modal identification", "Seismic response analysis", "Fragility"],
    techSlugs: ["ambient-vibration-modal-analysis", "seismic-response-dynamic-analysis", "fragility-probabilistic-assessment"],
  },
  {
    slug: "other-critical-infrastructure", title: "Other critical infrastructure",
    summary: "Retaining walls, slopes, barrages, canals and industrial structures with monitoring needs.",
    concerns: ["Slope movement", "Retaining-wall rotation", "Canal lining seepage"],
    instruments: ["Inclinometers", "Piezometers", "GNSS", "InSAR (imported third-party)"],
    analyses: ["Trend detection", "Correlation with rainfall and water level", "Digital twin dashboards"],
    techSlugs: ["statistical-analysis-regression", "digital-twins-predictive-management"],
  },
];

export const applicationBySlug = (s: string) => APPLICATIONS.find((a) => a.slug === s);
