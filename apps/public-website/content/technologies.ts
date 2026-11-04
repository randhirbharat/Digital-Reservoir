/* Technology pages — original explanatory content. Equations use plain Unicode for robust rendering. */

export type TechCategory = "Monitoring & data" | "Statistics & AI" | "Structural analysis" | "Assessment & twins";
export type FigureKind = "hst" | "filter" | "regression" | "fragility" | "frf" | "dhi" | "workflow";

export interface Technology {
  slug: string;
  num: number;
  title: string;
  category: TechCategory;
  summary: string;
  relevance: string;
  theory: string[];
  equations: { label: string; body: string }[];
  workflow: string[];
  inputs: string[];
  methods: string[];
  applications: string[];
  figure: FigureKind;
  refs: string[];
  lab: { label: string; path: string }[];
  status: "available" | "partial" | "planned";
}

export const TECHNOLOGIES: Technology[] = [
  {
    slug: "instrumentation-structural-monitoring", num: 1, title: "Instrumentation and structural monitoring", category: "Monitoring & data",
    summary: "Selecting, placing and maintaining sensors so that the measurements answer the engineering questions that matter.",
    relevance: "Monitoring is only as useful as the questions it was designed to answer. For dams, the classic questions concern deformation, seepage, pore and uplift pressure, temperature and joint behaviour under varying reservoir load. A sound instrumentation plan links each sensor to a failure mode or performance indicator, provides redundancy where decisions depend on it, and documents calibration and maintenance so that long records stay interpretable.",
    theory: [
      "Each instrument measures a physical quantity through a transduction principle — vibrating wire, resistance, capacitance, optical fibre, laser or GNSS — with its own resolution, drift, temperature sensitivity and failure modes.",
      "Measurement uncertainty combines sensor accuracy, installation effects, reading noise and calibration error. Interpretation must distinguish a real structural change from a change in the measurement system (replacement, re-zeroing, cable damage).",
    ],
    equations: [
      { label: "Vibrating-wire gauge (frequency to strain)", body: "ε = G · (f² − f₀²)        G: gauge factor, f₀: zero-reading frequency" },
      { label: "Measurement model", body: "y_meas = y_true + b + e        b: bias/drift, e ~ N(0, σ²) random error" },
    ],
    workflow: ["Define monitoring objectives and failure modes", "Select parameters, ranges and resolution", "Plan locations, redundancy and cabling", "Install, calibrate and record baseline readings", "Commission data acquisition and quality checks", "Review, maintain and recalibrate periodically"],
    inputs: ["Structure drawings and geology", "Failure-mode analysis", "Sensor specifications and calibration certificates", "Installation records and baseline readings"],
    methods: ["Failure-mode-based instrument selection", "Redundancy and cross-checking between instruments", "Calibration tracking and drift correction", "Metadata management (location, unit, component)"],
    applications: ["Plumb lines and pendulums", "Piezometers and uplift cells", "Seepage weirs", "Joint meters and crack meters", "Inclinometers and extensometers", "Thermometers and strain gauges"],
    figure: "workflow", refs: ["dunnicliff1993", "farrar2007"],
    lab: [{ label: "Data management", path: "/datasets" }], status: "available",
  },
  {
    slug: "data-acquisition-sensor-networks", num: 2, title: "Data acquisition and sensor networks", category: "Monitoring & data",
    summary: "Loggers, gateways and communication links that turn sensor signals into trustworthy, time-stamped records.",
    relevance: "Automated acquisition increases reading frequency and enables near-real-time review, but it also introduces new failure modes: clock drift, buffer overruns, communication outages and silent sensor faults. The acquisition chain must make these visible rather than hide them.",
    theory: [
      "Sampling must respect the dynamics of the measured quantity: slow quasi-static responses need consistent long-term sampling; vibration requires sampling well above the highest frequency of interest (Nyquist criterion) with anti-alias filtering.",
      "Time synchronisation across loggers is essential for correlating channels; all records should carry time-zone-aware timestamps.",
    ],
    equations: [
      { label: "Nyquist criterion", body: "f_s > 2 · f_max" },
      { label: "Data availability", body: "A = N_received / N_expected  over a window" },
    ],
    workflow: ["Register sensors and channels with metadata", "Configure sampling, scaling and units", "Transmit via MQTT, REST or file transfer", "Validate payloads and flag quality", "Store raw and processed streams separately", "Monitor communications and latency"],
    inputs: ["Sensor IDs and channel map", "Sampling plan", "Gateway credentials", "Time-synchronisation source"],
    methods: ["MQTT publish/subscribe with QoS", "Store-and-forward buffering", "Heartbeat and missing-data detection", "Clock-offset monitoring"],
    applications: ["Automated dam monitoring systems", "Bridge SHM networks", "Remote hydropower sites"],
    figure: "workflow", refs: ["farrar2012"],
    lab: [{ label: "Digital Twin connectors", path: "/twin" }], status: "partial",
  },
  {
    slug: "signal-processing-data-quality", num: 3, title: "Signal processing and data quality", category: "Monitoring & data",
    summary: "Cleaning, filtering and transforming records without losing the original — every step documented.",
    relevance: "Monitoring records contain gaps, duplicates, spikes, offsets after maintenance and measurement noise. Processing improves interpretability, but undocumented processing destroys evidence. Digital Reservoir keeps the original data untouched and records each operation as a new version with its parameters.",
    theory: [
      "Filters trade noise reduction against distortion. A zero-phase (forward–backward) Butterworth filter avoids time shifts but doubles the effective order; moving averages are simple but have poor frequency selectivity.",
      "Spectral analysis (FFT, Welch power spectral density) reveals periodic content; wavelets localise transients in time and frequency; STL separates trend, seasonal and remainder components.",
    ],
    equations: [
      { label: "Butterworth magnitude response", body: "|H(jω)|² = 1 / (1 + (ω/ω_c)^(2n))" },
      { label: "Welch PSD estimate", body: "P(f) = (1/K) Σₖ |FFT(w · x_k)|² / (f_s · Σ w²)" },
      { label: "Robust outlier score (MAD)", body: "z_i = 0.6745 · (x_i − median(x)) / MAD" },
    ],
    workflow: ["Validate file, timestamps and units", "Flag missing data, duplicates and outliers", "Correct baseline and offsets (documented)", "Filter / detrend / resample", "Compare original vs processed", "Save as a new version with history"],
    inputs: ["Time series with timestamps", "Sampling interval", "Maintenance and replacement events"],
    methods: ["Baseline correction", "Linear/polynomial detrending", "Moving average", "Butterworth low/high/band-pass", "FFT and Welch PSD", "Continuous wavelet transform", "STL seasonal decomposition"],
    applications: ["Pre-processing for HST and ML", "Vibration analysis", "Sensor fault diagnosis"],
    figure: "filter", refs: ["butterworth1930", "welch1967", "torrence1998", "cleveland1990"],
    lab: [{ label: "Data quality", path: "/datasets" }, { label: "Signal processing", path: "/analysis/signal" }], status: "available",
  },
  {
    slug: "statistical-analysis-regression", num: 4, title: "Statistical analysis and regression modelling", category: "Statistics & AI",
    summary: "Descriptive statistics, correlation, regression and diagnostics — the backbone of quantitative interpretation.",
    relevance: "Most behaviour models used in dam surveillance are regression models. Their credibility depends on diagnostics: residual independence, constant variance, multicollinearity and influential observations. Ignoring these produces confident but misleading intervals.",
    theory: [
      "Ordinary least squares estimates coefficients minimising squared residuals; standard errors and intervals rely on assumptions that monitoring data often violate (autocorrelation, heteroscedasticity).",
      "Principal component analysis finds orthogonal directions of maximum variance and is useful for summarising many correlated sensors and for multivariate anomaly screening.",
    ],
    equations: [
      { label: "OLS estimator", body: "β̂ = (XᵀX)⁻¹ Xᵀy" },
      { label: "Prediction interval (new x₀)", body: "ŷ₀ ± t_{α/2, n−p} · s · √(1 + x₀ᵀ(XᵀX)⁻¹x₀)" },
      { label: "Durbin–Watson statistic", body: "DW = Σ (e_t − e_{t−1})² / Σ e_t²" },
    ],
    workflow: ["Explore distributions and correlations", "Specify model and assumptions", "Estimate coefficients", "Check residual diagnostics", "Report intervals and limitations"],
    inputs: ["Response and explanatory variables", "Consistent sampling", "Known events to exclude or model"],
    methods: ["Descriptive statistics", "Pearson/Spearman correlation", "Simple, multiple and polynomial regression", "Breusch–Pagan, Durbin–Watson, VIF", "ACF/PACF", "PCA and factor analysis"],
    applications: ["Behaviour models", "Sensor redundancy checks", "Multivariate summaries of piezometer arrays"],
    figure: "regression", refs: ["montgomery2021", "jolliffe2002", "breusch1979", "box2015"],
    lab: [{ label: "Statistics & PCA", path: "/analysis/statistics" }], status: "available",
  },
  {
    slug: "hst-modelling", num: 5, title: "Hydrostatic–Season–Time (HST) modelling", category: "Statistics & AI",
    summary: "The reference statistical model for interpreting concrete dam behaviour under water load, temperature and time.",
    relevance: "Concrete dams respond mainly to reservoir water load, the seasonal thermal cycle and slow irreversible processes. HST separates these effects so that each new reading can be compared with what the loading explains, focusing attention on the unexplained part.",
    theory: [
      "The response is modelled as a polynomial in normalised reservoir level, harmonic terms of the day of year acting as a proxy for the thermal cycle, and monotonic functions of time for irreversible effects. Coefficients are estimated by least squares over a calibration period.",
      "The seasonal proxy assumes a repeatable thermal cycle; where concrete or air temperatures are measured, HTT-type variants replace the harmonics with temperature terms. Extrapolation beyond the calibrated reservoir range is unreliable.",
    ],
    equations: [
      { label: "Typical HST formulation", body: "δ(h,s,t) = a₀ + Σᵢ aᵢ hⁱ  (i = 1…4)\n        + b₁ sin s + b₂ cos s + b₃ sin² s + b₄ sin s cos s\n        + c₁ t + c₂ e^(−t)\nh = (H_max − H)/(H_max − H_min),   s = 2π d / 365.25" },
    ],
    workflow: ["Quality-control the record (original kept)", "Select response, reservoir level and time basis", "Split chronologically into calibration and validation", "Fit and inspect coefficients and diagnostics", "Report calibration and validation metrics separately", "Monitor standardised residuals against project criteria"],
    inputs: ["Response record (several annual cycles)", "Reservoir level", "Timestamps with time zone", "Maintenance and replacement events"],
    methods: ["OLS with QR decomposition", "Term selection", "HTT variant with measured temperatures", "Chronological and rolling-origin validation", "Prediction intervals", "Residual-based anomaly screening"],
    applications: ["Pendulum and plumb-line displacement", "Joint meters", "Piezometric levels", "Uplift and seepage", "Behavioural baselines for digital twins"],
    figure: "hst", refs: ["willm1967", "leger2007", "salazar2017", "mata2011"],
    lab: [{ label: "HST analysis", path: "/analysis/hst" }], status: "available",
  },
  {
    slug: "artificial-intelligence-machine-learning", num: 6, title: "Artificial intelligence and machine learning", category: "Statistics & AI",
    summary: "Flexible regression and anomaly models — validated in a way that respects time.",
    relevance: "Machine learning can capture nonlinear and delayed effects that HST misses, but monitoring data are autocorrelated: random train/test splits leak information and overstate skill. Chronological splits, rolling-origin evaluation and frozen test periods are mandatory for honest comparison.",
    theory: [
      "Tree ensembles (random forests, gradient boosting, XGBoost) handle nonlinearity and interactions with little tuning; support vector regression and k-nearest neighbours work well on small, smooth problems; recurrent networks (LSTM, GRU) learn temporal dependencies from sequences.",
      "Uncertainty can be expressed with prediction intervals, for example by split-conformal calibration on held-out residuals, which gives distribution-free coverage under exchangeability assumptions.",
    ],
    equations: [
      { label: "Error metrics", body: "MAE = (1/n) Σ|yᵢ − ŷᵢ|     RMSE = √((1/n) Σ (yᵢ − ŷᵢ)²)\nR² = 1 − Σ(yᵢ − ŷᵢ)² / Σ(yᵢ − ȳ)²     MAPE only if y never approaches 0" },
      { label: "Split-conformal interval", body: "ŷ(x) ± q_{1−α}( |y_j − ŷ(x_j)| , j ∈ calibration set )" },
    ],
    workflow: ["Select inputs and target", "Choose model and parameters", "Split chronologically (no shuffling)", "Train on calibration data only", "Validate and compare on identical splits", "Quantify uncertainty and explain"],
    inputs: ["Target and explanatory series", "Sufficient history covering operating range"],
    methods: ["Linear, Ridge, Lasso", "SVR, KNN, decision trees", "Random forest, gradient boosting, XGBoost", "ANN, LSTM, GRU, CNN, autoencoders", "Permutation importance", "Conformal prediction intervals"],
    applications: ["Behaviour prediction", "Gap filling (flagged as modelled)", "Anomaly screening"],
    figure: "regression", refs: ["salazar2017", "breiman2001", "chen2016", "hochreiter1997", "tashman2000", "bergmeir2012", "shafer2008"],
    lab: [{ label: "ML laboratory", path: "/analysis/ml" }], status: "partial",
  },
  {
    slug: "physics-informed-neural-networks", num: 7, title: "Physics-informed neural networks (PINNs)", category: "Statistics & AI",
    summary: "Neural networks trained to honour governing equations as well as data.",
    relevance: "When data are sparse or extrapolation is needed, purely data-driven models can produce physically implausible results. PINNs add the residual of a governing differential equation to the training loss so that the solution respects physics between and beyond observations.",
    theory: [
      "A network u_θ(x,t) approximates the field of interest. Automatic differentiation evaluates the differential operator on u_θ at collocation points, and the squared residual is penalised alongside data misfit and boundary conditions.",
      "Training can be difficult: loss-term balancing, stiffness and spectral bias are active research topics. PINNs are best treated as research tools until validated for a specific problem.",
    ],
    equations: [
      { label: "Composite loss", body: "L(θ) = L_data + λ_r · (1/N_r) Σ |𝒩[u_θ](x_r)|² + λ_b · L_boundary" },
      { label: "Example: 1-D transient heat conduction in concrete", body: "𝒩[T] = ∂T/∂t − α ∂²T/∂x²  = 0" },
    ],
    workflow: ["Formulate governing equation and boundary conditions", "Choose collocation points", "Define network and loss weights", "Train with data and physics terms", "Verify against analytical or numerical solutions", "Validate against independent measurements"],
    inputs: ["Governing equations and material parameters", "Boundary and initial conditions", "Sparse measurements"],
    methods: ["Automatic differentiation", "Adaptive loss weighting", "Inverse parameter identification"],
    applications: ["Thermal fields in mass concrete", "Seepage through foundations", "Parameter identification"],
    figure: "workflow", refs: ["raissi2019", "karniadakis2021"],
    lab: [{ label: "Hybrid models (Stage 6)", path: "/analysis/ml" }], status: "planned",
  },
  {
    slug: "hybrid-physics-data-modelling", num: 8, title: "Physics-based and data-driven hybrid modelling", category: "Statistics & AI",
    summary: "A physical model provides the backbone; a data model learns what the physics leaves unexplained.",
    relevance: "Hybrid models keep the interpretability of mechanics while capturing effects that are hard to model explicitly. A common pattern uses a finite-element or analytical hydrostatic response as an input and lets a statistical model learn thermal and time-dependent residuals.",
    theory: [
      "Residual (serial) hybrids model y = f_phys(x) + g_data(x) + ε. Parallel hybrids weight physics and data predictions. Bayesian calibration treats model discrepancy explicitly and propagates parameter uncertainty.",
      "Attribution must stay transparent: which part of a prediction comes from physics, which from data, and how each was validated.",
    ],
    equations: [
      { label: "Residual hybrid", body: "y(x) = f_phys(x; θ) + g_ML(x) + ε" },
      { label: "Kennedy–O'Hagan calibration", body: "y(x) = η(x, θ) + δ(x) + ε" },
    ],
    workflow: ["Build or import physical response (e.g. FE hydrostatic influence)", "Compute residuals against measurements", "Learn residual model with chronological validation", "Combine and quantify uncertainty", "Report contributions separately"],
    inputs: ["Physical model outputs", "Measured response", "Environmental variables"],
    methods: ["Residual learning", "Bayesian calibration", "Gaussian-process discrepancy"],
    applications: ["Dam displacement with FE hydrostatic term", "Model updating in digital twins"],
    figure: "workflow", refs: ["kennedy2001", "karniadakis2021", "salazar2017"],
    lab: [{ label: "Hybrid models (Stage 6)", path: "/analysis/ml" }], status: "planned",
  },
  {
    slug: "structural-health-monitoring", num: 9, title: "Structural health monitoring", category: "Assessment & twins",
    summary: "Detecting, locating and assessing change in structures from monitoring data.",
    relevance: "SHM aims to identify damage — changes to material or geometric properties that affect performance — through measured response. Environmental and operational variability often dominates damage effects, so normalising for temperature and load is central.",
    theory: [
      "The statistical pattern-recognition paradigm: operational evaluation, data acquisition, feature extraction and statistical model development for feature discrimination.",
      "Damage-sensitive features include model residuals, modal parameters and their shifts, and multivariate distances from a baseline.",
    ],
    equations: [
      { label: "Mahalanobis novelty index", body: "D²(x) = (x − μ)ᵀ Σ⁻¹ (x − μ)" },
      { label: "CUSUM change detection", body: "S_t = max(0, S_{t−1} + z_t − k),   alarm if S_t > h" },
    ],
    workflow: ["Define baseline period", "Extract features", "Normalise for environment and operations", "Detect novelty and change points", "Investigate with engineering review"],
    inputs: ["Baseline data", "Features (residuals, frequencies)", "Environmental records"],
    methods: ["Residual-based detection", "Mahalanobis distance", "Isolation forest", "CUSUM and change-point detection", "Sensor fusion"],
    applications: ["Dams", "Bridges", "Buildings", "Tunnels"],
    figure: "workflow", refs: ["farrar2007", "farrar2012", "page1954", "liu2008"],
    lab: [{ label: "Damage detection", path: "/analysis/anomaly" }], status: "available",
  },
  {
    slug: "dam-health-index", num: 10, title: "Quantitative Dam Health Index", category: "Assessment & twins",
    summary: "A transparent, configurable index that aggregates indicators — every weight traceable.",
    relevance: "Health indices communicate condition across many indicators, but they can hide judgement behind a single number. A defensible index documents its indicators, normalisation, weights, aggregation, sensitivity and uncertainty, and never presents default weights as validated engineering criteria.",
    theory: [
      "Indicators are normalised to a common 0–1 scale using project-specific reference values. Weights may be elicited with the Analytic Hierarchy Process, which checks the consistency of pairwise comparisons.",
      "Weighted arithmetic aggregation allows compensation between indicators; geometric or minimum-based aggregation limits it. Sensitivity analysis shows how strongly the index depends on each weight.",
    ],
    equations: [
      { label: "Weighted aggregation", body: "DHI = Σᵢ wᵢ Iᵢ,   Σ wᵢ = 1,   Iᵢ ∈ [0, 1]" },
      { label: "AHP consistency ratio", body: "CI = (λ_max − n)/(n − 1),   CR = CI / RI,   accept if CR < 0.10" },
    ],
    workflow: ["Select indicators with justification", "Define normalisation per indicator", "Elicit and check weights (AHP)", "Aggregate and classify with documented bands", "Run sensitivity and uncertainty analysis", "Interpret and report"],
    inputs: ["Indicator values over time", "Reference/threshold values per indicator (project-specific)", "Expert pairwise judgements"],
    methods: ["Min–max and threshold normalisation", "AHP eigenvector weighting", "Arithmetic/geometric aggregation", "One-at-a-time and Monte Carlo sensitivity"],
    applications: ["Portfolio prioritisation", "Trend reporting between assessment periods"],
    figure: "dhi", refs: ["saaty1980"],
    lab: [{ label: "Dam Health Index", path: "/analysis/dhi" }], status: "available",
  },
  {
    slug: "numerical-finite-element-modelling", num: 11, title: "Numerical and finite element modelling", category: "Structural analysis",
    summary: "Geometry, mesh, materials and loads — and the visualisation of their results next to monitoring data.",
    relevance: "Finite element models explain why a structure behaves as measured and predict response to loads not yet experienced. Digital Reservoir visualises results exported from established FE software; it does not claim to run validated nonlinear solutions itself.",
    theory: [
      "The weak form of equilibrium is discretised into elements; the global system K u = f is solved for nodal displacements, from which strains and stresses follow.",
      "Mesh quality, boundary conditions (foundation extent, reservoir representation) and material parameters dominate result reliability; verification and validation must be documented.",
    ],
    equations: [{ label: "Static equilibrium", body: "K u = f,     σ = D B u" }],
    workflow: ["Build geometry and mesh", "Assign materials and boundary conditions", "Apply load combinations", "Solve in validated software", "Export results (nodes, elements, fields)", "Import and compare with monitoring"],
    inputs: ["Geometry (CAD/IFC)", "Material properties", "Load cases", "Result export files"],
    methods: ["Result import (CSV/VTK-style tables)", "Contour visualisation", "Model comparison"],
    applications: ["Stress and displacement assessment", "Influence lines for hybrid models"],
    figure: "workflow", refs: ["zienkiewicz2013"],
    lab: [{ label: "Numerical results viewer (Stage 6)", path: "/analysis" }], status: "planned",
  },
  {
    slug: "nonlinear-analysis-concrete", num: 12, title: "Nonlinear analysis of concrete structures", category: "Structural analysis",
    summary: "Cracking, crushing and joint opening — behaviour beyond the elastic range.",
    relevance: "Mass concrete cracks in tension long before it crushes; joints and the dam–foundation interface open and slide. Nonlinear analysis is needed for extreme loading and for interpreting observed cracking.",
    theory: [
      "Smeared-crack and plastic-damage models represent stiffness degradation; interface elements with Mohr–Coulomb friction capture joint and contact behaviour.",
      "Results are sensitive to fracture energy, tensile strength and mesh size; regularisation is required for objective results.",
    ],
    equations: [{ label: "Scalar damage", body: "σ = (1 − d) D₀ (ε − εᵖ),   0 ≤ d ≤ 1" }, { label: "Mohr–Coulomb interface", body: "|τ| ≤ c + μ σₙ" }],
    workflow: ["Calibrate material model", "Define interfaces and joints", "Incremental–iterative solution", "Check convergence and energy balance", "Interpret cracking patterns"],
    inputs: ["Material tests", "Joint geometry", "Load history"],
    methods: ["Plastic-damage models", "Interface/contact elements", "Arc-length solution"],
    applications: ["Seismic safety evaluation", "Crack interpretation"],
    figure: "workflow", refs: ["lee1998", "zienkiewicz2013"],
    lab: [{ label: "Numerical results viewer (Stage 6)", path: "/analysis" }], status: "planned",
  },
  {
    slug: "fluid-structure-interaction", num: 13, title: "Fluid-structure interaction", category: "Structural analysis",
    summary: "How the reservoir loads and moves with the dam during earthquakes.",
    relevance: "During seismic shaking the reservoir exerts hydrodynamic pressures on the upstream face. Representation ranges from added-mass approximations to coupled acoustic–structure models with absorbing boundaries.",
    theory: [
      "Westergaard's classical solution approximates hydrodynamic pressure on a rigid vertical face as a parabolic added mass.",
      "Coupled formulations model water as an acoustic fluid, accounting for compressibility, reservoir-bottom absorption and radiation.",
    ],
    equations: [{ label: "Westergaard added mass (per unit area)", body: "m_a(z) = (7/8) ρ_w √(H (H − z))" }, { label: "Acoustic wave equation", body: "∇²p = (1/c²) ∂²p/∂t²" }],
    workflow: ["Choose representation", "Define reservoir domain and boundaries", "Couple with structure", "Analyse and compare with simplified methods"],
    inputs: ["Reservoir geometry and level", "Water properties", "Ground motion"],
    methods: ["Added mass", "Acoustic elements", "Absorbing boundaries"],
    applications: ["Seismic analysis of concrete dams", "Intake towers"],
    figure: "workflow", refs: ["westergaard1933", "chopra2017"],
    lab: [{ label: "Seismic module (Stage 6)", path: "/analysis" }], status: "planned",
  },
  {
    slug: "ambient-vibration-modal-analysis", num: 14, title: "Ambient vibration and operational modal analysis", category: "Structural analysis",
    summary: "Natural frequencies, damping and mode shapes from output-only measurements.",
    relevance: "Modal parameters reflect stiffness and boundary conditions. Tracking them over time — after normalising for reservoir level and temperature — provides global damage-sensitive indicators and data for model updating.",
    theory: [
      "Operational modal analysis assumes broadband ambient excitation. Frequency-domain decomposition takes the singular value decomposition of the cross-spectral matrix; stochastic subspace identification fits a state-space model in the time domain.",
      "Damping estimates are far more uncertain than frequencies and should be reported with their scatter.",
    ],
    equations: [
      { label: "SDOF frequency response", body: "|H(ω)| = 1 / √((k − mω²)² + (cω)²)" },
      { label: "Half-power damping estimate", body: "ζ ≈ (ω₂ − ω₁) / (2 ω_n)" },
    ],
    workflow: ["Record multi-channel ambient vibration", "Pre-process (detrend, filter, decimate)", "Estimate spectra", "Identify modes (peak picking, FDD, SSI)", "Track over time and normalise", "Compare with FE modes (MAC)"],
    inputs: ["Accelerometer records", "Sensor layout", "Sampling rate"],
    methods: ["FFT and PSD", "Peak picking", "FDD", "SSI", "Modal assurance criterion"],
    applications: ["Dam and bridge modal tracking", "Model updating"],
    figure: "frf", refs: ["brincker2001", "brincker2015", "peeters1999", "chopra2017"],
    lab: [{ label: "Modal analysis", path: "/analysis/modal" }], status: "partial",
  },
  {
    slug: "seismic-response-dynamic-analysis", num: 15, title: "Seismic response and dynamic analysis", category: "Structural analysis",
    summary: "Ground-motion selection, time-history response and engineering demand parameters.",
    relevance: "Seismic assessment requires appropriately selected ground motions, a dynamic model that captures the dominant mechanisms, and demand parameters linked to damage states.",
    theory: [
      "The equation of motion is integrated in time (e.g. Newmark-β). Response spectra summarise peak response of SDOF systems and support record selection and scaling.",
      "Record-to-record variability is usually the largest source of demand uncertainty.",
    ],
    equations: [{ label: "Equation of motion", body: "M ü + C u̇ + K u = −M ι ü_g(t)" }],
    workflow: ["Define hazard and intensity measure", "Select and scale records", "Run time-history analyses", "Extract EDPs", "Summarise statistics"],
    inputs: ["Ground-motion records", "Dynamic model", "Damping assumptions"],
    methods: ["Newmark integration", "Response spectra", "Record selection"],
    applications: ["Seismic safety evaluation", "Input to fragility analysis"],
    figure: "workflow", refs: ["chopra2017", "cornell2002"],
    lab: [{ label: "Seismic module (Stage 6)", path: "/analysis" }], status: "planned",
  },
  {
    slug: "fragility-probabilistic-assessment", num: 16, title: "Fragility and probabilistic vulnerability assessment", category: "Assessment & twins",
    summary: "Probability of exceeding a damage state as a function of seismic intensity.",
    relevance: "Fragility functions express vulnerability probabilistically and feed risk calculations. Parameters must come from analyses of the specific structure — assumed parameters are illustrations, not assessments.",
    theory: [
      "A lognormal CDF is commonly fitted to IDA results or to binary exceed/not-exceed observations by maximum likelihood (multiple stripe analysis).",
      "Confidence bands from bootstrap resampling express estimation uncertainty from a finite number of records.",
    ],
    equations: [
      { label: "Lognormal fragility", body: "P(DS ≥ ds | IM = x) = Φ( ln(x/θ) / β )" },
      { label: "MLE for multiple stripes", body: "max_{θ,β} Σⱼ [ zⱼ ln pⱼ + (nⱼ − zⱼ) ln(1 − pⱼ) ]" },
    ],
    workflow: ["Define damage states and EDP thresholds", "Run IDA or multiple stripe analysis", "Count exceedances per intensity level", "Fit lognormal by MLE", "Bootstrap confidence bands", "Compare models and sensitivities"],
    inputs: ["IM–EDP pairs from dynamic analyses", "Damage-state definitions"],
    methods: ["IDA post-processing", "MLE fitting", "Bootstrap", "Sensitivity analysis"],
    applications: ["Seismic risk of dams and appurtenant structures", "Retrofit prioritisation"],
    figure: "fragility", refs: ["vamvatsikos2002", "baker2015", "shinozuka2000"],
    lab: [{ label: "Fragility", path: "/analysis/fragility" }], status: "partial",
  },
  {
    slug: "computer-vision-damage-detection", num: 17, title: "Computer vision and image-based damage detection", category: "Assessment & twins",
    summary: "Finding cracks, spalling and seepage traces in inspection images — with confidence and verification status.",
    relevance: "Image analysis can make inspections more consistent and searchable. Model detections are candidates: they must be reviewed and confirmed by an engineer before being recorded as findings.",
    theory: [
      "Convolutional networks classify image patches or segment pixels (e.g. U-Net). Classical filters (edge and ridge detection, morphological operations) give transparent baselines for crack-like features.",
      "Performance depends strongly on lighting, surface texture and resolution; metrics must be reported on images representative of the target structure.",
    ],
    equations: [{ label: "Segmentation overlap", body: "IoU = |A ∩ B| / |A ∪ B|" }],
    workflow: ["Upload and register images (location, date)", "Run detection", "Review and annotate", "Map to structure", "Compare over time"],
    inputs: ["Inspection images with metadata", "Annotated examples for training/validation"],
    methods: ["Ridge/edge filters", "CNN classification", "U-Net segmentation", "Change detection"],
    applications: ["Concrete crack mapping", "Spalling and efflorescence", "Seepage traces"],
    figure: "workflow", refs: ["cha2017", "ronneberger2015"],
    lab: [{ label: "Image analysis (Stage 6)", path: "/analysis/images" }], status: "planned",
  },
  {
    slug: "digital-twins-predictive-management", num: 18, title: "Digital twins and predictive infrastructure management", category: "Assessment & twins",
    summary: "A living, two-way link between a structure, its data and its models.",
    relevance: "A useful engineering digital twin connects geometry, sensors, data quality, behaviour models and decisions — and updates as the structure and its data evolve. It is a system, not a 3D picture.",
    theory: [
      "Core elements: an asset representation, sensor-to-structure mapping, a data pipeline with provenance, analytical models with versioning, and decision workflows (alerts, reviews).",
      "State estimation (e.g. Kalman filtering) and model updating keep the virtual representation consistent with measurements.",
    ],
    equations: [{ label: "Kalman update", body: "x̂ₖ = x̂ₖ⁻ + Kₖ (zₖ − H x̂ₖ⁻),   Kₖ = Pₖ⁻Hᵀ (H Pₖ⁻ Hᵀ + R)⁻¹" }],
    workflow: ["Represent asset and components", "Map sensors to structure", "Stream and validate data", "Run behaviour models", "Raise and review alerts", "Update models and report"],
    inputs: ["3D model (GLB/glTF; IFC via conversion)", "Sensor registry", "Data streams", "Validated models"],
    methods: ["Sensor-to-structure mapping", "Streaming analytics", "Residual monitoring", "Historical replay"],
    applications: ["Dam surveillance", "Bridge management", "Portfolio decision support"],
    figure: "workflow", refs: ["grieves2017", "kalman1960"],
    lab: [{ label: "Digital Twin", path: "/twin" }], status: "partial",
  },
];

export const techBySlug = (slug: string) => TECHNOLOGIES.find((t) => t.slug === slug);
export const TECH_CATEGORIES: TechCategory[] = ["Monitoring & data", "Statistics & AI", "Structural analysis", "Assessment & twins"];
