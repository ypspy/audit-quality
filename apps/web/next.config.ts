import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["react-markdown", "remark-gfm"],
  async redirects() {
    return [
      {
        source: "/tools/dart",
        destination: "/dart",
        permanent: false,
      },
      {
        source: "/tools/dart/:path*",
        destination: "/dart/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
