"use client";
import { useParams, useRouter } from "next/navigation";
import { EngineeringDisclaimer } from "@dr/design-system";
import { RunPanel } from "@/components/results";
import { KV, Panel, Spinner } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import type { Run } from "@/lib/types";

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: run, error } = useApi<Run>(`/lab/analyses/${id}`);
  if (error) return <p className="text-cond-critical">{error}</p>;
  if (!run) return <Spinner />;
  return (
    <div className="space-y-5">
      <RunPanel run={run} onDeleted={() => router.push("/runs")} />
      <Panel title="Parameters (as executed)"><KV items={Object.entries(run.params).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)])} /></Panel>
      <EngineeringDisclaimer />
    </div>
  );
}
