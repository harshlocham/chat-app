import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const localEnvPath = path.resolve(currentDir, ".env");
const rootEnvPath = path.resolve(currentDir, "../../.env");

if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath });
}
if (existsSync(rootEnvPath)) {
  loadEnv({ path: rootEnvPath });
}

const nextConfig: NextConfig = {
  /* config options here */
  //output: 'standalone',
  transpilePackages: ["@chat/auth"],
  images: {
    domains: [
      "lh3.googleusercontent.com",
      "ik.imagekit.io"
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io", // or your CDN
      },
    ],
  },
};

export default nextConfig;
