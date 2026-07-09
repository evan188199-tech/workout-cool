import type { NextConfig } from "next";

const nextConfig: NextConfig = {
reactStrictMode: true,
 devIndicators: false,
 turbopack: {
    // This project is the workspace root; pin it so Turbopack does not
    // infer a parent directory (another lockfile lives one level up).
    root: __dirname,
  },
 // Allow access to the dev server from the public reverse proxy
 // (VPS 8.163.58.44 -> SSH tunnel -> local :3000) for ad-hoc web previews.
 // Also include the LAN IP so browsing the dev server from another device
 // (http://192.168.31.100:3000) works. Next 16 blocks cross-origin fetches
 // to /_next and the dev middleware for any host that is not localhost or
 // listed here, which breaks login/navigation/RSC even though the page
 // itself loads. localhost is always allowed.
 // Dev-mode only; has no effect on `next build` / `next start`.
 allowedDevOrigins: [
   "8.163.58.44",
   "http://8.163.58.44",
   "192.168.31.100",
   "http://192.168.31.100",
 ],
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "http", hostname: "192.168.1.12" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "www.facebook.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "**.vercel.app" },
      { protocol: "https", hostname: "static.exercisedb.dev" },
    ],
  },
};

export default nextConfig;
