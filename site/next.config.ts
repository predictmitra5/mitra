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
  // Protective browser headers, as on the app (security review, 2026-10-21).
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
