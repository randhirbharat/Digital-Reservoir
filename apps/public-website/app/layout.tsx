import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: "Digital Reservoir — Intelligence for Infrastructure", template: "%s | Digital Reservoir" },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { type: "website", siteName: SITE.name, title: "Digital Reservoir — Intelligence for Infrastructure", description: SITE.description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#10232D", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-app="public">
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
