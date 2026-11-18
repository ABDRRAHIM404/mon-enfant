import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    minimumCacheTTL: 86400,
    localPatterns: [
      { pathname: "/brand/**", search: "" },
      { pathname: "/dashboard-art/**", search: "" },
    ],
  },
  async headers() {
    return [
      {
        source: "/brand/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/dashboard-art/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/share/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  experimental: {
    // Reuse public/static segments and loading boundaries. Authorized dynamic
    // pages always refresh; never keep medical payloads in a shared cache.
    staleTimes: { dynamic: 0, static: 300 },
    serverActions: {
      // 4 MiB evidence plus 256 KiB form overhead, below the 4.5 MB platform cap.
      bodySizeLimit: 4352 * 1024,
    },
  },
};
export default nextConfig;
