import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // shadcn's registry ships components importing `cn` from "cn" — the stock
    // engine, which doesn't know our custom @theme tokens. Point it at our
    // extended wrapper so added components work unmodified.
    resolveAlias: { cn: "./lib/utils" },
  },
};

export default nextConfig;
