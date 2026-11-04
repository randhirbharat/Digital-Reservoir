/**
 * Reference catalogue — well-established external works cited on technology pages.
 * These are NOT Digital Reservoir publications. Bibliographic details were compiled from standard
 * sources; the site editor must verify every entry (and add DOIs) before relying on it.
 * DOIs are given only where they are widely reproduced and well known.
 */
export type RefType = "journal" | "book" | "conference" | "report";
export interface Reference {
  id: string;
  authors: string;
  year: number;
  title: string;
  venue: string;
  type: RefType;
  subjects: string[];
  doi?: string;
}

export const REFERENCES: Reference[] = [
  { id: "willm1967", authors: "Willm, G.; Beaujoint, N.", year: 1967, title: "Les méthodes de surveillance des barrages au service de la production hydraulique d'Électricité de France — problèmes anciens et solutions nouvelles", venue: "Proc. 9th ICOLD Congress, Istanbul (Q34 R30)", type: "conference", subjects: ["HST", "Dam monitoring"] },
  { id: "leger2007", authors: "Léger, P.; Leclerc, M.", year: 2007, title: "Hydrostatic, temperature, time-displacement model for concrete dams", venue: "Journal of Engineering Mechanics, 133(3), 267–277", type: "journal", subjects: ["HST", "Dam monitoring"] },
  { id: "salazar2017", authors: "Salazar, F.; Morán, R.; Toledo, M.Á.; Oñate, E.", year: 2017, title: "Data-based models for the prediction of dam behaviour: a review and some methodological considerations", venue: "Archives of Computational Methods in Engineering, 24(1), 1–21", type: "journal", subjects: ["Machine learning", "HST", "Dam monitoring"] },
  { id: "mata2011", authors: "Mata, J.", year: 2011, title: "Interpretation of concrete dam behaviour with artificial neural network and multiple linear regression models", venue: "Engineering Structures, 33(3), 903–910", type: "journal", subjects: ["Machine learning", "HST"] },
  { id: "farrar2007", authors: "Farrar, C.R.; Worden, K.", year: 2007, title: "An introduction to structural health monitoring", venue: "Philosophical Transactions of the Royal Society A, 365, 303–315", type: "journal", subjects: ["Structural health monitoring"], doi: "10.1098/rsta.2006.1928" },
  { id: "farrar2012", authors: "Farrar, C.R.; Worden, K.", year: 2012, title: "Structural Health Monitoring: A Machine Learning Perspective", venue: "Wiley", type: "book", subjects: ["Structural health monitoring", "Machine learning"] },
  { id: "dunnicliff1993", authors: "Dunnicliff, J.", year: 1993, title: "Geotechnical Instrumentation for Monitoring Field Performance", venue: "Wiley", type: "book", subjects: ["Instrumentation"] },
  { id: "raissi2019", authors: "Raissi, M.; Perdikaris, P.; Karniadakis, G.E.", year: 2019, title: "Physics-informed neural networks: a deep learning framework for solving forward and inverse problems involving nonlinear partial differential equations", venue: "Journal of Computational Physics, 378, 686–707", type: "journal", subjects: ["PINN", "Machine learning"], doi: "10.1016/j.jcp.2018.10.045" },
  { id: "karniadakis2021", authors: "Karniadakis, G.E.; Kevrekidis, I.G.; Lu, L.; Perdikaris, P.; Wang, S.; Yang, L.", year: 2021, title: "Physics-informed machine learning", venue: "Nature Reviews Physics, 3, 422–440", type: "journal", subjects: ["PINN", "Hybrid modelling"], doi: "10.1038/s42254-021-00314-5" },
  { id: "kennedy2001", authors: "Kennedy, M.C.; O'Hagan, A.", year: 2001, title: "Bayesian calibration of computer models", venue: "Journal of the Royal Statistical Society B, 63(3), 425–464", type: "journal", subjects: ["Hybrid modelling", "Uncertainty"] },
  { id: "vamvatsikos2002", authors: "Vamvatsikos, D.; Cornell, C.A.", year: 2002, title: "Incremental dynamic analysis", venue: "Earthquake Engineering & Structural Dynamics, 31(3), 491–514", type: "journal", subjects: ["Seismic", "Fragility"], doi: "10.1002/eqe.141" },
  { id: "baker2015", authors: "Baker, J.W.", year: 2015, title: "Efficient analytical fragility function fitting using dynamic structural analysis", venue: "Earthquake Spectra, 31(1), 579–599", type: "journal", subjects: ["Fragility"], doi: "10.1193/021113EQS025M" },
  { id: "shinozuka2000", authors: "Shinozuka, M.; Feng, M.Q.; Lee, J.; Naganuma, T.", year: 2000, title: "Statistical analysis of fragility curves", venue: "Journal of Engineering Mechanics, 126(12), 1224–1231", type: "journal", subjects: ["Fragility"] },
  { id: "cornell2002", authors: "Cornell, C.A.; Jalayer, F.; Hamburger, R.O.; Foutch, D.A.", year: 2002, title: "Probabilistic basis for 2000 SAC Federal Emergency Management Agency steel moment frame guidelines", venue: "Journal of Structural Engineering, 128(4), 526–533", type: "journal", subjects: ["Seismic", "Fragility"] },
  { id: "chopra2017", authors: "Chopra, A.K.", year: 2017, title: "Dynamics of Structures: Theory and Applications to Earthquake Engineering (5th ed.)", venue: "Pearson", type: "book", subjects: ["Seismic", "Modal analysis"] },
  { id: "westergaard1933", authors: "Westergaard, H.M.", year: 1933, title: "Water pressures on dams during earthquakes", venue: "Transactions of the ASCE, 98, 418–433", type: "journal", subjects: ["Fluid-structure interaction", "Seismic"] },
  { id: "brincker2001", authors: "Brincker, R.; Zhang, L.; Andersen, P.", year: 2001, title: "Modal identification of output-only systems using frequency domain decomposition", venue: "Smart Materials and Structures, 10(3), 441–445", type: "journal", subjects: ["Modal analysis"] },
  { id: "brincker2015", authors: "Brincker, R.; Ventura, C.E.", year: 2015, title: "Introduction to Operational Modal Analysis", venue: "Wiley", type: "book", subjects: ["Modal analysis"] },
  { id: "peeters1999", authors: "Peeters, B.; De Roeck, G.", year: 1999, title: "Reference-based stochastic subspace identification for output-only modal analysis", venue: "Mechanical Systems and Signal Processing, 13(6), 855–878", type: "journal", subjects: ["Modal analysis"] },
  { id: "zienkiewicz2013", authors: "Zienkiewicz, O.C.; Taylor, R.L.; Zhu, J.Z.", year: 2013, title: "The Finite Element Method: Its Basis and Fundamentals (7th ed.)", venue: "Butterworth-Heinemann", type: "book", subjects: ["Finite element"] },
  { id: "lee1998", authors: "Lee, J.; Fenves, G.L.", year: 1998, title: "Plastic-damage model for cyclic loading of concrete structures", venue: "Journal of Engineering Mechanics, 124(8), 892–900", type: "journal", subjects: ["Nonlinear concrete", "Finite element"] },
  { id: "saaty1980", authors: "Saaty, T.L.", year: 1980, title: "The Analytic Hierarchy Process", venue: "McGraw-Hill", type: "book", subjects: ["Health index", "Decision analysis"] },
  { id: "welch1967", authors: "Welch, P.D.", year: 1967, title: "The use of fast Fourier transform for the estimation of power spectra: a method based on time averaging over short, modified periodograms", venue: "IEEE Transactions on Audio and Electroacoustics, 15(2), 70–73", type: "journal", subjects: ["Signal processing"] },
  { id: "butterworth1930", authors: "Butterworth, S.", year: 1930, title: "On the theory of filter amplifiers", venue: "Wireless Engineer, 7, 536–541", type: "journal", subjects: ["Signal processing"] },
  { id: "torrence1998", authors: "Torrence, C.; Compo, G.P.", year: 1998, title: "A practical guide to wavelet analysis", venue: "Bulletin of the American Meteorological Society, 79(1), 61–78", type: "journal", subjects: ["Signal processing"] },
  { id: "cleveland1990", authors: "Cleveland, R.B.; Cleveland, W.S.; McRae, J.E.; Terpenning, I.", year: 1990, title: "STL: a seasonal-trend decomposition procedure based on loess", venue: "Journal of Official Statistics, 6(1), 3–73", type: "journal", subjects: ["Signal processing", "Time series"] },
  { id: "montgomery2021", authors: "Montgomery, D.C.; Peck, E.A.; Vining, G.G.", year: 2021, title: "Introduction to Linear Regression Analysis (6th ed.)", venue: "Wiley", type: "book", subjects: ["Statistics"] },
  { id: "jolliffe2002", authors: "Jolliffe, I.T.", year: 2002, title: "Principal Component Analysis (2nd ed.)", venue: "Springer", type: "book", subjects: ["Statistics"] },
  { id: "breusch1979", authors: "Breusch, T.S.; Pagan, A.R.", year: 1979, title: "A simple test for heteroscedasticity and random coefficient variation", venue: "Econometrica, 47(5), 1287–1294", type: "journal", subjects: ["Statistics"] },
  { id: "box2015", authors: "Box, G.E.P.; Jenkins, G.M.; Reinsel, G.C.; Ljung, G.M.", year: 2015, title: "Time Series Analysis: Forecasting and Control (5th ed.)", venue: "Wiley", type: "book", subjects: ["Time series", "Statistics"] },
  { id: "tashman2000", authors: "Tashman, L.J.", year: 2000, title: "Out-of-sample tests of forecasting accuracy: an analysis and review", venue: "International Journal of Forecasting, 16(4), 437–450", type: "journal", subjects: ["Validation", "Machine learning"] },
  { id: "bergmeir2012", authors: "Bergmeir, C.; Benítez, J.M.", year: 2012, title: "On the use of cross-validation for time series predictor evaluation", venue: "Information Sciences, 191, 192–213", type: "journal", subjects: ["Validation", "Machine learning"] },
  { id: "shafer2008", authors: "Shafer, G.; Vovk, V.", year: 2008, title: "A tutorial on conformal prediction", venue: "Journal of Machine Learning Research, 9, 371–421", type: "journal", subjects: ["Uncertainty", "Machine learning"] },
  { id: "breiman2001", authors: "Breiman, L.", year: 2001, title: "Random forests", venue: "Machine Learning, 45, 5–32", type: "journal", subjects: ["Machine learning"], doi: "10.1023/A:1010933404324" },
  { id: "chen2016", authors: "Chen, T.; Guestrin, C.", year: 2016, title: "XGBoost: a scalable tree boosting system", venue: "Proc. 22nd ACM SIGKDD Conference on Knowledge Discovery and Data Mining", type: "conference", subjects: ["Machine learning"], doi: "10.1145/2939672.2939785" },
  { id: "hochreiter1997", authors: "Hochreiter, S.; Schmidhuber, J.", year: 1997, title: "Long short-term memory", venue: "Neural Computation, 9(8), 1735–1780", type: "journal", subjects: ["Machine learning"], doi: "10.1162/neco.1997.9.8.1735" },
  { id: "liu2008", authors: "Liu, F.T.; Ting, K.M.; Zhou, Z.-H.", year: 2008, title: "Isolation forest", venue: "Proc. 8th IEEE International Conference on Data Mining (ICDM)", type: "conference", subjects: ["Anomaly detection"] },
  { id: "page1954", authors: "Page, E.S.", year: 1954, title: "Continuous inspection schemes", venue: "Biometrika, 41(1/2), 100–115", type: "journal", subjects: ["Anomaly detection", "Statistics"] },
  { id: "kalman1960", authors: "Kalman, R.E.", year: 1960, title: "A new approach to linear filtering and prediction problems", venue: "Journal of Basic Engineering, 82(1), 35–45", type: "journal", subjects: ["Digital twin", "Signal processing"] },
  { id: "cha2017", authors: "Cha, Y.-J.; Choi, W.; Büyüköztürk, O.", year: 2017, title: "Deep learning-based crack damage detection using convolutional neural networks", venue: "Computer-Aided Civil and Infrastructure Engineering, 32(5), 361–378", type: "journal", subjects: ["Computer vision"] },
  { id: "ronneberger2015", authors: "Ronneberger, O.; Fischer, P.; Brox, T.", year: 2015, title: "U-Net: convolutional networks for biomedical image segmentation", venue: "Proc. MICCAI 2015", type: "conference", subjects: ["Computer vision"] },
  { id: "grieves2017", authors: "Grieves, M.; Vickers, J.", year: 2017, title: "Digital twin: mitigating unpredictable, undesirable emergent behavior in complex systems", venue: "In: Transdisciplinary Perspectives on Complex Systems, Springer", type: "book", subjects: ["Digital twin"] },
];

export const refById = (id: string) => REFERENCES.find((r) => r.id === id);
export function formatReference(r: Reference): string {
  return `${r.authors} (${r.year}). ${r.title}. ${r.venue}.`;
}
