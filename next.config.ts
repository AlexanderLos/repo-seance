import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // GitHub-hosted assets the app may render (owner avatars, raw README media).
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "opengraph.githubassets.com" },
    ],
  },
};

export default nextConfig;
