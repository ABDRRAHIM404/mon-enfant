import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // 4 MiB evidence plus 256 KiB form overhead, below the 4.5 MB platform cap.
      bodySizeLimit: 4352 * 1024,
    },
  },
};
export default nextConfig;
