import type { NextConfig } from "next";

const developmentNoStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, max-age=0, must-revalidate",
  },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1", "192.168.0.*"],
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
  async headers() {
    if (process.env.NODE_ENV !== "development") return [];

    return [
      {
        source: "/:path*",
        headers: developmentNoStoreHeaders,
      },
    ];
  },
};

export default nextConfig;
