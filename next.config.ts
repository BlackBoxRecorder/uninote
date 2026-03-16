import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "sharp",
    "cos-nodejs-sdk-v5",
    "bcryptjs",
  ],
  experimental: {
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
