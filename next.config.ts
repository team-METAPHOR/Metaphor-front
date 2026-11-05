import type { NextConfig } from "next";

// scheme://host[:port] 만 쓴다. 값에 /api 같은 경로가 붙어 있어도 /api/v1 이 이중으로 붙지 않게 한다.
const apiOrigin = new URL(process.env.API_ORIGIN || "http://localhost:8000").origin;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // 세션 쿠키가 같은 출처로 붙도록 API를 같은 도메인 아래로 프록시한다.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
