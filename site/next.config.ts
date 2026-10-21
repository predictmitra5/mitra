import path from "node:path";
import type { NextConfig } from "next";

/*
 * Mitra's website (DECISIONS.md 2026-10-20, "Mitra's own website") is its own
 * project inside the app's repository. Without these two roots Next.js would
 * see the app's lockfile one folder up and treat the repository as the
 * workspace.
 */
const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
