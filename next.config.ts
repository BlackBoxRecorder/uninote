import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "sharp",
    "cos-nodejs-sdk-v5",
    "bcryptjs",
    "@larksuiteoapi/node-sdk",
  ],
  experimental: {
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
