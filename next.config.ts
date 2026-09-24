import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    // Add the image storage host once chosen (open decision), e.g.
    // remotePatterns: [new URL("https://images.easypick.com.np/**")],
  },
};

export default nextConfig;
