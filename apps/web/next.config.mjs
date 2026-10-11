/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Marketplace product photos are seller-provided URLs (Supabase Storage
    // plus external hosts). Wildcard remote patterns trade host lockdown for
    // working UGC images; revisit with a hardened loader if abuse appears.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
