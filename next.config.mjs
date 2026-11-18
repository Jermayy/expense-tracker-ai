/**
 * Static export: the app is fully client-side (localStorage), so production
 * ships as plain HTML/JS with no Next.js server. This keeps the server-side
 * attack surface (image optimizer, server actions, RSC endpoints) out of prod.
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
