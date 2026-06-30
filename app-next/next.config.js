/** @type {import('next').NextConfig} */

// next-auth/react parses NEXTAUTH_URL at module load; an empty value breaks static prerender.
const defaultNextAuthUrl =
  process.env.NODE_ENV === "production"
    ? "https://www.circadia24.com"
    : "http://localhost:3000";
if (!process.env.NEXTAUTH_URL?.trim()) {
  process.env.NEXTAUTH_URL = defaultNextAuthUrl;
}

const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;

