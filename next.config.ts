import type { NextConfig } from "next";

// Content-Security-Policy. A static header (not per-request nonces): nonces would make every
// page dynamic, and the shop relies on static/ISR pages. So inline scripts stay allowed
// (Next's own bootstrap, the /pay auto-submit form), but everything else is locked to this
// site: no scripts, frames or plugins from elsewhere, forms only to us and the wallets.
const isDev = process.env.NODE_ENV === "development";
const supabaseOrigin = (() => {
  try {
    return process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();
const csp = [
  "default-src 'self'",
  // 'unsafe-eval' only in development: React uses eval there for better error stacks.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self' data:",
  "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  // eSewa's form (sandbox rc-epay / live epay, and its own redirects), plus the switched-off wallets.
  "form-action 'self' https://esewa.com.np https://*.esewa.com.np https://*.fonepay.com https://khalti.com https://*.khalti.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

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
      // See csp above; it also stops other sites framing Easypick (clickjacking the admin or checkout).
      { key: "Content-Security-Policy", value: csp },
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
