import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
export const metadata: Metadata = { title: "Terms and disclaimer" };
export default function Page() {
  return <LegalPage title="Terms and disclaimer" href="/terms" note="Draft terms — to be legally reviewed before production."
    sections={[
      ["Technical disclaimer", ["Website content, demonstrations, Engineering Lab outputs and Digital Twin indicators do not constitute a structural-safety assessment, statutory certification, emergency advice, design approval or a substitute for qualified professional engineering judgement."]],
      ["Use of analytical tools", ["Users are responsible for verifying inputs, units, assumptions and outputs. A high model fit does not prove structural safety, and an anomaly does not by itself prove damage."]],
      ["Demonstration data", ["Public dashboards and examples use synthetic or simulated data that are labelled as such and must not be interpreted as the condition of any real asset."]],
      ["Formal engagement", ["Use of this website does not establish a consultancy agreement. A project engagement begins only when scope, terms, roles and deliverables are agreed in writing."]],
    ]} />;
}
