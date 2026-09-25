import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser tests run their own dev server beside yours, in a separate build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    // Product photos uploaded in the admin live in Supabase Storage.
    remotePatterns: process.env.SUPABASE_URL ? [new URL(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/**`)] : [],
  },
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      // No other site may put Easypick in a frame (clickjacking the admin or checkout).
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Frame-Options", value: "DENY" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ];
    // Private links (gift pages, orders) never leak to other sites through the Referer header.
    const privateLinks = [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex" }];
    return [
      { source: "/:path*", headers: common },
      { source: "/g/:path*", headers: privateLinks },
      { source: "/order/:path*", headers: privateLinks },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/helper/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  experimental: {
    // Product photos are uploaded from the admin screen through a Server Action.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
