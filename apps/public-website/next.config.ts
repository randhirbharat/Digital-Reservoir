import path from "node:path";
import type { NextConfig } from "next";

const apiInternal = process.env.DR_API_INTERNAL_URL || "http://localhost:8000";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// NEXT_PUBLIC_STATIC_PREVIEW=1 builds a static export of the public website (e.g. for GitHub Pages under NEXT_PUBLIC_BASE_PATH).
// The Lab, Twin and API need a server, so the preview links to "run locally" instructions instead of to them.
const staticPreview = process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const serverConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiInternal}/api/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const staticConfig: NextConfig = { output: "export", basePath, trailingSlash: true, images: { unoptimized: true } };

const config: NextConfig = {
  transpilePackages: ["@dr/design-system", "@dr/shared-utilities"],
  poweredByHeader: false,
  ...(staticPreview ? staticConfig : serverConfig),
};
export default config;
