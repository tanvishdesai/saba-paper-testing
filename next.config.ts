import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
