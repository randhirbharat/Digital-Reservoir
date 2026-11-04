import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@dr/authentication";

export const metadata: Metadata = {
  title: { default: "Digital Reservoir | Digital Twin", template: "%s | Digital Twin" },
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-app="twin">
      <body className="min-h-screen"><SessionProvider>{children}</SessionProvider></body>
    </html>
  );
}
