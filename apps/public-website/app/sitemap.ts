import type { MetadataRoute } from "next";
import { TECHNOLOGIES } from "@/content/technologies";
import { APPLICATIONS } from "@/content/applications";
import { ARTICLES } from "@/content/articles";
import { SITE } from "@/lib/site";
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "");
  const pages = ["", "/technologies", "/applications", "/research", "/publications", "/resources", "/engineering-lab", "/digital-twin", "/about", "/contact", "/privacy", "/terms", "/cookies"];
  return [
    ...pages.map((p) => ({ url: `${base}${p}` })),
    ...TECHNOLOGIES.map((t) => ({ url: `${base}/technologies/${t.slug}` })),
    ...APPLICATIONS.map((a) => ({ url: `${base}/applications/${a.slug}` })),
    ...ARTICLES.map((a) => ({ url: `${base}/research/${a.slug}`, lastModified: a.date })),
  ];
}
