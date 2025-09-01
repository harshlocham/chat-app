import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  //output: 'standalone',
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
