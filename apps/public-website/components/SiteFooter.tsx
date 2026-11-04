import Link from "next/link";
import { Logo } from "@dr/design-system";

export function SiteFooter() {
  return (
    <footer className="bg-navy text-[#9DB3AE] mt-0">
      <div className="dr-container py-14 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr] grid-cols-1 min-w-0">
        <div className="space-y-4">
          <Logo tone="dark" size={40} />
          <p className="text-sm max-w-[40ch]">Turning infrastructure data into engineering intelligence.</p>
        </div>
        <FooterCol title="Platform" links={[["/technologies", "Technologies"], ["/applications", "Applications"], ["/engineering-lab", "Engineering Lab"], ["/digital-twin", "Digital Twin"]]} />
        <FooterCol title="Knowledge" links={[["/research", "Research and Insights"], ["/publications", "Publications"], ["/resources", "Resources"]]} />
        <FooterCol title="Organisation" links={[["/about", "About"], ["/contact", "Contact"], ["/privacy", "Privacy policy"], ["/cookies", "Cookie policy"], ["/terms", "Terms and disclaimer"]]} />
      </div>
      <div className="dr-container border-t border-[#26434D] py-6 text-[0.8rem] leading-relaxed">
        © {new Date().getFullYear()} Digital Reservoir. Demonstrations use synthetic or simulated data and are labelled as such. Outputs are
        decision support and do not replace inspection, qualified engineering judgement, statutory review or emergency procedures.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="text-ivory font-semibold text-sm mb-3">{title}</h2>
      <ul className="space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}><Link href={href} className="hover:text-aqua">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
