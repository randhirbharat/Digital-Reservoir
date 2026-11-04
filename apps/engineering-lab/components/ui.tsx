"use client";
import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from "react";
import { formatNumber } from "@dr/shared-utilities";

export function Panel({ title, children, actions, className = "" }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[14px] border border-line bg-surface p-4 sm:p-5 min-w-0 ${className}`}>
      {title || actions ? <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display font-bold text-[1.05rem]">{title}</h2>{actions}</div> : null}
      {children}
    </section>
  );
}

export function PageTitle({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="font-display font-extrabold text-[clamp(1.4rem,2vw+0.8rem,1.9rem)]">{title}</h1>{lead ? <p className="mt-1 text-sm text-muted max-w-[80ch]">{lead}</p> : null}</div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return <label className="block"><span className="dr-label">{label}</span>{children}{hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}</label>;
}

export function Select({ options, placeholder, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select {...props} className={`dr-field ${props.className || ""}`}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`dr-field ${props.className || ""}`} />;
}

export function CheckList({ options, value, onChange, label }: { options: string[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="dr-label">{label}</legend>
      <div className="max-h-44 overflow-y-auto rounded-[9px] border border-line p-2 space-y-1">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm min-h-[30px]">
            <input type="checkbox" checked={value.includes(o)} onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))} className="size-4" />
            <span className="font-mono truncate">{o}</span>
          </label>
        ))}
        {!options.length ? <p className="text-xs text-muted">No suitable columns.</p> : null}
      </div>
    </fieldset>
  );
}

export function ErrorBox({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <div role="alert" className="rounded-[10px] border border-cond-critical/40 bg-cond-critical/10 px-3 py-2 text-sm text-cond-critical">{children}</div>;
}

export function Warnings({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div role="note" className="rounded-[10px] border border-cond-attention/50 bg-cond-attention/10 px-4 py-3 text-sm space-y-1">
      <div className="font-semibold">Warnings</div>
      <ul className="list-disc pl-5">{items.map((w) => <li key={w}>{w}</li>)}</ul>
    </div>
  );
}

export function Spinner({ label = "Working…" }: { label?: string }) {
  return <span role="status" className="inline-flex items-center gap-2 text-sm text-muted"><span className="size-4 animate-spin rounded-full border-2 border-line border-t-accent" />{label}</span>;
}

export function fmt(v: unknown, digits = 4): string {
  if (typeof v === "number") return formatNumber(v, digits);
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

export function DataTable({ rows, columns, labels }: { rows: Record<string, any>[]; columns?: string[]; labels?: Record<string, string> }) {
  if (!rows?.length) return null;
  const cols = columns || Object.keys(rows[0]);
  return (
    <div className="dr-table-wrap">
      <table className="dr-table">
        <thead><tr>{cols.map((c) => <th key={c} scope="col">{labels?.[c] ?? c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className={typeof r[c] === "number" ? "font-mono tabular" : ""}>{fmt(r[c])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {items.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="m-0 font-mono break-words">{v}</dd></div>)}
    </dl>
  );
}
