import type { NextConfig } from 'next';

/**
 * Phase 1 is a fully static, browser-only app: `next build` writes a static site to out/
 * that can be hosted on Vercel, Netlify, Cloudflare Pages or any static file server.
 * Phase 2 (API routes, login) removes `output: 'export'`.
 */
const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  // The floating dev badge covers the drop zone in the bottom-left corner.
  devIndicators: false,
};

export default nextConfig;
