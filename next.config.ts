import type { NextConfig } from "next";

/*
 * Protective browser headers on every response (security review, 2026-10-21):
 * no other site may frame Mitra's pages (its one-click owner and account forms
 * included), browsers must not guess content types, addresses leave the site
 * without their path, and the browser features Mitra never uses are switched
 * off. Autoplay, fullscreen and picture-in-picture stay allowed, since the
 * founder videos' YouTube player needs them.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Uploads no longer pass through server actions (2026-09-24): Vercel refuses
// request bodies over 4.5 MB, so files go from the browser straight to storage
// and actions carry only small requests. Next.js's default 1 MB limit applies.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Founder handles in the @ format (2026-10-21): app.mitra.market/@name is the founder's page.
  async rewrites() {
    return [{ source: "/@:handle([a-z0-9_]{2,30})", destination: "/founders/:handle" }];
  },
  // Old addresses (2026-10-08 and 2026-10-19): goal and event pages land on
  // their startup-era equivalents.
  async redirects() {
    return [
      { source: "/goals/new", destination: "/create", permanent: false },
      { source: "/suggest", destination: "/create", permanent: false },
      { source: "/venues/:slug*", destination: "/markets", permanent: false },
      { source: "/positions", destination: "/portfolio", permanent: false },
    ];
  },
};

export default nextConfig;
