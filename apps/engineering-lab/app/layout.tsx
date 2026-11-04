import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@dr/authentication";

export const metadata: Metadata = {
  title: { default: "Engineering Lab | Digital Reservoir", template: "%s | Engineering Lab" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-app="lab">
      <body className="min-h-screen"><SessionProvider>{children}</SessionProvider></body>
    </html>
  );
}
