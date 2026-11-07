import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@remotion/bundler", "@remotion/cli"],
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
