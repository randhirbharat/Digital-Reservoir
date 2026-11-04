import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = { title: "Contact", description: "Contact Digital Reservoir about research collaboration, pilot projects, Engineering Lab support or Digital Twin access." };

export default function ContactPage() {
  return (
    <>
      <PageHero title="Contact" crumbs={[{ href: "/contact", label: "Contact" }]}
        lead="Share your infrastructure type, objective and available information. We reply with a scoped technical note." />
      <div className="dr-container py-12 grid gap-10 lg:grid-cols-[1fr_1.4fr] grid-cols-1 min-w-0">
        <div className="space-y-4">
          <h2 className="font-display font-bold text-xl">Get in touch</h2>
          <p className="text-muted">Email: <span className="font-mono">[contact address to be configured]</span></p>
          <p className="text-muted">Location: Roorkee, Uttarakhand, India</p>
          <p className="text-sm text-muted">Enquiries are stored securely and used only to respond to you. See the <a href="/privacy" className="underline">privacy policy</a>.</p>
        </div>
        <ContactForm />
      </div>
    </>
  );
}
