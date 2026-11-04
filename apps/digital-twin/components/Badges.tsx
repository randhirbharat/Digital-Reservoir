import { ConditionBadge, ProvenanceBadge } from "@dr/design-system";
import type { ConditionLevel, DataProvenance } from "@dr/shared-utilities";
export function Cond({ level, basis }: { level: ConditionLevel; basis?: string }) {
  return <span title={basis}><ConditionBadge level={level} /></span>;
}
export function Prov({ kind }: { kind: DataProvenance }) { return <ProvenanceBadge kind={kind} />; }
export function Quality({ q }: { q: string | null }) {
  const c = q === "good" ? "text-[#5FB592]" : q === "suspect" ? "text-[#E0AE52]" : q === "bad" ? "text-[#E06A6A]" : "text-muted";
  return <span className={`text-xs font-semibold ${c}`}>{q ?? "—"}</span>;
}
