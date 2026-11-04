import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
export const metadata: Metadata = { title: "Privacy policy" };
export default function Page() {
  return <LegalPage title="Privacy policy" href="/privacy" note="Draft policy — to be completed and legally reviewed before production (legal entity, hosting location, retention periods, designated contacts)."
    sections={[
      ["Information we collect", ["Contact enquiries: name, email, organisation and message content you submit.", "Engineering Lab and Digital Twin accounts: name, email, membership category, authentication and security logs (sign-ins, sessions, access decisions).", "Files and data you upload to the Engineering Lab or that authorised gateways send to a Digital Twin project."]],
      ["How information is used", ["To respond to enquiries, provide the platform, secure accounts, keep audit trails, and meet contractual or legal obligations. Digital Reservoir does not sell personal information."]],
      ["Project data", ["Project and monitoring data are isolated per project and visible only to authorised members. Operational infrastructure information is treated as sensitive."]],
      ["Your rights", ["You may request access to, correction of or deletion of your personal data, subject to legal retention requirements."]],
    ]} />;
}
