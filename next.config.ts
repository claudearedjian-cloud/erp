import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN devices to access dev resources (HMR, dev chunks, etc.).
  // Without this, Next.js 16+ blocks cross-origin requests to /_next/* from
  // any host other than localhost, which makes the page render as a shell
  // with empty data when accessed over the LAN.
  //
  // In development, a wide open allowlist is the right tradeoff: this file
  // is only loaded by `next dev` (never by `next start` or `next build`),
  // and the dev server is never reachable from the public internet.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    // Common private network ranges
    "192.168.44.*",   // old VMware NAT subnet
    "192.168.220.*",  // physical LAN subnet
    "10.*",           // any 10.x.x.x private network host
    "172.16.*",       // any 172.16-31.x.x private network host
  ],
};

export default nextConfig;
