import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads: proof up to 10 MB, profile photos up to 8 MB. Server actions
    // default to 1 MB, which silently refused most proof and phone photos.
    // 11 MB leaves room for multipart overhead; each service still enforces
    // its own, smaller limit.
    serverActions: { bodySizeLimit: "11mb" },
    // The proxy buffers request bodies up to this size before the action runs.
    proxyClientMaxBodySize: "11mb",
  },
};

export default nextConfig;
