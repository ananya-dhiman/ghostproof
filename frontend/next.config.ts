import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Lets us import ../shared (types + config owned by Person A) from outside this folder.
  experimental: { externalDir: true },
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
