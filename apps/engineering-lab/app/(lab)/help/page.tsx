import { PageTitle, Panel } from "@/components/ui";

const SECTIONS: [string, string[]][] = [
  ["Data provenance", ["Every dataset is labelled historical (measured), imported (third-party) or synthetic. The label travels with every analysis and report.", "Version 1 is the uploaded file, stored unchanged with its SHA-256 checksum. Processing always creates a new version with the operations and parameters recorded."]],
  ["Time handling", ["Timestamps are parsed as UTC. Timestamps without a zone are assumed to be UTC and a warning is shown.", "Resampling places data on a regular grid using the chosen aggregation; empty intervals stay missing — nothing is interpolated unless you add an interpolation step."]],
  ["Validation of models", ["Monitoring data are autocorrelated. All model validation in the Lab is chronological: calibration uses the earliest data and validation the later data.", "Calibration metrics describe goodness of fit only. Use validation metrics to judge predictive performance. MAPE is reported only where the target never approaches zero."]],
  ["HST formulation", ["y = a₀ + Σ aᵢ hⁱ + Σ [b sin(ks) + b cos(ks)] + time terms + ε, with h = (H_max − H)/(H_max − H_min) using calibration-period bounds and s = 2π·day/365.25.", "Selecting a temperature column switches to the HTT variant. Predictions outside the calibrated reservoir range are extrapolations and are flagged."]],
  ["Machine learning", ["Available now: linear, Ridge, Lasso, SVR, KNN, decision tree, random forest, gradient boosting, XGBoost and a multilayer perceptron (ANN).", "LSTM, GRU, CNN, autoencoders and PINNs require the PyTorch runtime planned for Stage 6.", "Prediction intervals use split-conformal calibration on the end of each calibration window."]],
  ["Dam Health Index", ["You define indicators, reference values, weights (or AHP judgements) and condition classes. The Lab supplies no default weights or thresholds.", "The consistency ratio of AHP judgements and the sensitivity of the index to each weight are always reported."]],
  ["Reports and exports", ["Each analysis has an HTML report (print to PDF from your browser) and a CSV export of its plotted series. Exports of long series may be downsampled for display — this is stated in the file header."]],
  ["Engineering responsibility", ["Lab outputs are decision support. They do not replace inspection, project-specific analysis, statutory review or the judgement of the responsible engineer."]],
];

export default function Help() {
  return (
    <>
      <PageTitle title="Documentation" lead="How the Engineering Lab handles data, models and results." />
      <div className="grid gap-5 lg:grid-cols-2">
        {SECTIONS.map(([t, ps]) => <Panel key={t} title={t}><div className="space-y-2 text-sm">{ps.map((p) => <p key={p.slice(0, 30)}>{p}</p>)}</div></Panel>)}
      </div>
    </>
  );
}
