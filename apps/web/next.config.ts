import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotEnv } from "dotenv";

// Ensure the web app can run from monorepo root env files in Turbo workspaces.
const rootEnvPath = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnvPath)) {
  loadDotEnv({ path: rootEnvPath, override: false });
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