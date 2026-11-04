import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
export const metadata: Metadata = { title: "Cookie policy" };
export default function Page() {
  return <LegalPage title="Cookie policy" href="/cookies" note="Reflects the current implementation; update if analytics or other tools are added."
    sections={[
      ["Public website", ["The public website sets no cookies and loads no analytics or advertising scripts."]],
      ["Engineering Lab and Digital Twin", ["After you sign in, a strictly necessary session cookie (HttpOnly, Secure in production) keeps you authenticated across the Digital Reservoir applications. It expires when you sign out or after the configured session lifetime."]],
    ]} />;
}
