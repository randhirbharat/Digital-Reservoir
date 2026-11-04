"use client";
import type { ReactNode } from "react";
export function Panel({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[14px] border border-line bg-surface p-4 min-w-0 ${className}`}>
      {title || actions ? <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display font-bold text-[1rem] text-ivory">{title}</h2>{actions}</div> : null}
      {children}
    </section>
  );
}
export function ErrorBox({ children }: { children?: ReactNode }) {
  return children ? <div role="alert" className="rounded-[10px] border border-[#E06A6A]/50 bg-[#E06A6A]/10 px-3 py-2 text-sm text-[#F2B8B8]">{children}</div> : null;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return <label className="block"><span className="dr-label">{label}</span>{children}{hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}</label>;
}
export function DemoBanner() {
  return (
    <div role="note" className="border-b border-[#5C4D22] bg-[#2A2416] px-4 py-2 text-[0.82rem] text-[#F0DDB0]">
      <strong className="tracking-[0.08em]">DEMONSTRATION DATA</strong> — simulated data stream for an illustrative structure. These are not measurements of any real dam.
    </div>
  );
}
