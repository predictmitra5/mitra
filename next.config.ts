import type { NextConfig } from "next";

// Uploads no longer pass through server actions (2026-09-24): Vercel refuses
// request bodies over 4.5 MB, so files go from the browser straight to storage
// and actions carry only small requests. Next.js's default 1 MB limit applies.
const nextConfig: NextConfig = {
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
