import { appUrls } from "@dr/shared-utilities";

export const SITE = {
  name: "Digital Reservoir",
  tagline: "Intelligence for Infrastructure",
  description:
    "Digital Reservoir integrates instrumentation, scientific computing, artificial intelligence and structural assessment for safer and smarter dams and critical infrastructure.",
  url: process.env.NEXT_PUBLIC_PUBLIC_URL || "http://localhost:3000",
};

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/technologies", label: "Technologies" },
  { href: "/applications", label: "Applications" },
  { href: "/research", label: "Research and Insights" },
  { href: "/publications", label: "Publications" },
  { href: "/resources", label: "Resources" },
  { href: "/engineering-lab", label: "Engineering Lab" },
  { href: "/digital-twin", label: "Digital Twin" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const urls = appUrls();
