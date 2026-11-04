import type { DataProvenance, ConditionLevel } from "@dr/shared-utilities";
import { PROVENANCE_LABEL, CONDITION_LABEL } from "@dr/shared-utilities";

const provStyle: Record<DataProvenance, string> = {
  live: "bg-cond-normal/15 text-cond-normal border-cond-normal/40",
  historical: "bg-accent/10 text-accent-ink border-accent-ink/40",
  simulated: "bg-bronze/20 text-bronze-ink border-bronze/60",
  synthetic: "bg-bronze/20 text-bronze-ink border-bronze/60",
  imported: "bg-sage text-teal border-sage-200",
  model: "bg-surface-2 text-ink border-line",
  assumption: "bg-surface-2 text-muted border-line border-dashed",
  interpretation: "bg-surface-2 text-ink border-line",
};

/** Mandatory label distinguishing measured, simulated, imported, modelled and interpreted content. */
export function ProvenanceBadge({ kind, className = "" }: { kind: DataProvenance; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold tracking-[0.08em] uppercase ${provStyle[kind]} ${className}`}
      title={PROVENANCE_LABEL[kind].description}
    >
      <span aria-hidden className="inline-block size-1.5 rounded-full bg-current" />
      {PROVENANCE_LABEL[kind].short}
    </span>
  );
}

const condStyle: Record<ConditionLevel, string> = {
  normal: "text-cond-normal border-cond-normal/50",
  attention: "text-cond-attention border-cond-attention/50",
  warning: "text-cond-warning border-cond-warning/50",
  critical: "text-cond-critical border-cond-critical/50",
  unavailable: "text-cond-unavailable border-cond-unavailable/50",
  not_assessed: "text-muted border-line border-dashed",
};
const condShape: Record<ConditionLevel, string> = {
  normal: "●", attention: "▲", warning: "◆", critical: "■", unavailable: "○", not_assessed: "–",
};

/** Condition chip — always shows a text label and a shape, never colour alone. */
export function ConditionBadge({ level, className = "" }: { level: ConditionLevel; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${condStyle[level]} ${className}`}>
      <span aria-hidden>{condShape[level]}</span>
      {CONDITION_LABEL[level]}
    </span>
  );
}
