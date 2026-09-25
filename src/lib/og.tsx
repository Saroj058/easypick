import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Shared pieces for the share images (what WhatsApp, Instagram and Facebook show for a link).

export const OG_SIZE = { width: 1200, height: 630 };
export const INK = "#0a0a0a";
export const VOLT = "#c6ff3d";

const dataUrl = (buf: Buffer, type: string) => `data:${type};base64,${buf.toString("base64")}`;

export async function logo(white = false) {
  return dataUrl(await readFile(join(process.cwd(), "public", "brand", white ? "logo-white.png" : "logo.png")), "image/png");
}

/**
 * A product photo as a data URL, from /public or from Storage. Null when there's none, or
 * it's WebP (the image renderer only reads JPEG and PNG).
 */
export async function photo(src: string | null | undefined): Promise<string | null> {
  if (!src || /\.webp($|\?)/i.test(src)) return null;
  try {
    if (src.startsWith("/")) {
      const buf = await readFile(join(process.cwd(), "public", decodeURIComponent(src.split("?")[0])));
      return dataUrl(buf, /\.png$/i.test(src) ? "image/png" : "image/jpeg");
    }
    const res = await fetch(src, { signal: AbortSignal.timeout(5000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/image\/(jpeg|png)/.test(type)) return null;
    return dataUrl(Buffer.from(await res.arrayBuffer()), type);
  } catch {
    return null;
  }
}
