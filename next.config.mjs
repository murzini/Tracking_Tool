/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // playwright-core and @sparticuz/chromium are Node.js-only server packages;
  // exclude them from webpack bundling so Next.js resolves them at runtime.
  experimental: {
    serverComponentsExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  },
};
export default nextConfig;
