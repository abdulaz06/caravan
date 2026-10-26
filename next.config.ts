import type { NextConfig } from "next";
import { assertSafeInfra } from "./src/lib/infra-guard";

// Refuse to run `next dev`, `next build` or `next start` against a protected
// database (see src/lib/infra-guard.ts). The server checks again at runtime.
assertSafeInfra();

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    qualities: [60, 75, 85],
  },
};

export default nextConfig;
