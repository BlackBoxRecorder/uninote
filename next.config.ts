import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "sharp",
    "cos-nodejs-sdk-v5",
    "bcryptjs",
  ],
};

export default nextConfig;
