"use client";

import { useEffect } from "react";

import { track } from "@/lib/track";

/** Counts one product page view for Trending (once per page load). */
export function TrackView({ slug }: { slug: string }) {
  useEffect(() => track(slug, "view"), [slug]);
  return null;
}
