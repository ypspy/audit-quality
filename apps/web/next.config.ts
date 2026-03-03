import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["react-markdown", "remark-gfm"],
};

export default nextConfig;
