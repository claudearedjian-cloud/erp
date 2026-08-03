import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the LAN IP to access dev resources (HMR, dev chunks, etc.).
  // Without this, Next.js 16+ blocks cross-origin requests to /_next/* from
  // any host other than localhost, which makes the page render as a shell
  // with empty data when accessed over the LAN.
  allowedDevOrigins: [
    "192.168.44.134",
    "192.168.44.*",   // any 192.168.44.x LAN host
    "10.*",           // any 10.x.x.x private network host
    "172.16.*",       // any 172.16-31.x.x private network host
    "localhost",
  ],
};

export default nextConfig;
