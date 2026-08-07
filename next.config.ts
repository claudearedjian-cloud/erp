import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable Next.js standalone output for the portable .exe builder.
  // This produces a minimal .next/standalone folder containing only what's
  // needed to run the app, which we then bundle with Node.js into a single
  // Windows .exe via `pkg`.
  output: "standalone",

  // Allow LAN devices to access dev resources (HMR, dev chunks, etc.).
  // In development, a wide open allowlist is the right tradeoff: this file
  // is only loaded by `next dev`, and the dev server is never reachable
  // from the public internet.
  // (No effect on the production build used by the portable .exe.)
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.44.*",
    "192.168.220.*",
    "10.*",
    "172.16.*",
  ],
};

export default nextConfig;
