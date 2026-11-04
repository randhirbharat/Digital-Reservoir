import type { NextConfig } from "next";

const apiInternal = process.env.DR_API_INTERNAL_URL || "http://localhost:8000";

const config: NextConfig = {
  transpilePackages: ["@dr/design-system", "@dr/shared-utilities", "@dr/authentication", "@dr/shared-types"],
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiInternal}/api/:path*` }];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "same-origin" },
      ],
    }];
  },
};
export default config;
