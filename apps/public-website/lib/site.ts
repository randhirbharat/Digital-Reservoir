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

/** True in the static GitHub Pages preview, where no API, Lab or Twin server is available. */
export const STATIC_PREVIEW = process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1";
/** Prefix for plain <a href> / asset URLs (next/link adds the base path itself). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const asset = (p: string) => `${BASE_PATH}${p}`;
/** Link into the Engineering Lab / Digital Twin; in the static preview these go to the run-locally page. */
export const labHref = (path = "") => (STATIC_PREVIEW ? `${BASE_PATH}/run-locally/` : `${urls.lab}${path}`);
export const twinHref = (path = "") => (STATIC_PREVIEW ? `${BASE_PATH}/run-locally/` : `${urls.twin}${path}`);
