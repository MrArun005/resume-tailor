import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages run only on the server and must not be bundled by Turbopack/webpack.
  serverExternalPackages: ["playwright", "playwright-core", "html-to-docx"],
  // Pin the workspace root to this project (avoid Next picking up a stray home-dir lockfile).
  turbopack: { root: process.cwd() },
};

export default nextConfig;
