import type { NextConfig } from "next";

// Uploads no longer pass through server actions (2026-09-24): Vercel refuses
// request bodies over 4.5 MB, so files go from the browser straight to storage
// and actions carry only small requests. Next.js's default 1 MB limit applies.
const nextConfig: NextConfig = {
  // Goal markets ended on 2026-10-08; an old "Post a goal" link lands on suggestions.
  async redirects() {
    return [{ source: "/goals/new", destination: "/suggest", permanent: false }];
  },
};

export default nextConfig;
