import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-surface border border-line rounded-[var(--radius-card)] ${className}`} {...props} />;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-[0.72rem] font-bold tracking-[0.18em] uppercase text-accent-ink ${className}`}>{children}</div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  className = "",
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={className}>
      {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
      <Tag className="font-display font-bold text-[clamp(1.6rem,2.6vw+0.6rem,2.6rem)] text-ink">{title}</Tag>
      {lead ? <p className="mt-3 text-muted text-[1.05rem] max-w-[68ch]">{lead}</p> : null}
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
  className = "",
}: {
  children: ReactNode;
  tone?: "info" | "caution";
  className?: string;
}) {
  const style =
    tone === "caution"
      ? "border-l-cond-attention bg-[color-mix(in_srgb,var(--color-cond-attention)_10%,var(--dr-surface))]"
      : "border-l-accent-ink bg-surface-2";
  return (
    <div role="note" className={`border border-line border-l-4 rounded-[10px] px-4 py-3 text-sm text-ink ${style} ${className}`}>
      {children}
    </div>
  );
}

/** Standard engineering-integrity disclaimer used across all three applications. */
export function EngineeringDisclaimer({ className = "" }: { className?: string }) {
  return (
    <Notice tone="caution" className={className}>
      Analytical outputs are decision-support information. They are not a structural-safety certification, a
      statutory dam-safety assessment or a substitute for qualified engineering judgement, inspection and
      project-specific review.
    </Notice>
  );
}

export function Stat({ label, value, unit, hint }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-[12px] p-4 min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-mono tabular text-xl text-ink truncate">
        {value}
        {unit ? <span className="text-sm text-muted ml-1">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
