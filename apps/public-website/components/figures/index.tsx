import type { FigureKind } from "@/content/technologies";
import { HstDemo } from "./HstDemo";
import { FilterDemo } from "./FilterDemo";
import { RegressionDemo } from "./RegressionDemo";
import { FragilityDemo } from "./FragilityDemo";
import { FrfDemo } from "./FrfDemo";
import { DhiDemo } from "./DhiDemo";
import { WorkflowFigure } from "./WorkflowFigure";

export function TechFigure({ kind, workflow, title }: { kind: FigureKind; workflow: string[]; title: string }) {
  switch (kind) {
    case "hst": return <HstDemo />;
    case "filter": return <FilterDemo />;
    case "regression": return <RegressionDemo />;
    case "fragility": return <FragilityDemo />;
    case "frf": return <FrfDemo />;
    case "dhi": return <DhiDemo />;
    default: return <WorkflowFigure steps={workflow} title={`${title} workflow`} />;
  }
}
