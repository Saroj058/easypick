import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/bag", "/checkout", "/order/", "/account", "/login", "/signup", "/g/", "/gift/", "/api/"] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
