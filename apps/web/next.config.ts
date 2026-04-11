import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

const currentDir = process.cwd();

const localEnvPath = path.resolve(currentDir, ".env");
const rootEnvPath = path.resolve(currentDir, "../../.env");

if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath });
}
if (existsSync(rootEnvPath)) {
  loadEnv({ path: rootEnvPath });
}

const nextConfig: NextConfig = {
  transpilePackages: ["@chat/auth"],
  images: {
    domains: ["lh3.googleusercontent.com", "ik.imagekit.io"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
    ],
  },
};

export default nextConfig;