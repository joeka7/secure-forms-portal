/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // better-sqlite3 is a native module: load it from node_modules at runtime instead of bundling it.
    serverComponentsExternalPackages: ["better-sqlite3"],
    // Every page shows per-user, permission-scoped data that other people can change (submissions,
    // users, category access), so client-side navigation must not reuse a page's data from the
    // Router Cache (Next.js 14.2 reuses it for 30 seconds by default). Browser back/forward is
    // handled in components/shell/useRefreshOnHistoryNavigation.ts.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
