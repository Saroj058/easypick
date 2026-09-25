import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    // Product photos uploaded in the admin live in Supabase Storage.
    remotePatterns: process.env.SUPABASE_URL ? [new URL(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/**`)] : [],
  },
  experimental: {
    // Product photos are uploaded from the admin screen through a Server Action.
    serverActions: { bodySizeLimit: "9mb" },
  },
};

export default nextConfig;
