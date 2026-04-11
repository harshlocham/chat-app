import type { NextConfig } from "next";

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