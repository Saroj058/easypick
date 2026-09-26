import "server-only";

import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

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
      // Only files inside public/ (no "../" tricks).
      const root = resolve(process.cwd(), "public");
      const file = resolve(root, `.${decodeURIComponent(src.split(/[?#]/)[0])}`);
      if (!file.startsWith(root + sep)) return null;
      const buf = await readFile(file);
      if (buf.length > MAX_OG_PHOTO_BYTES) return null;
      return dataUrl(buf, /\.png$/i.test(file) ? "image/png" : "image/jpeg");
    }
    // Only our own Supabase Storage photos; no redirects elsewhere; size-capped.
    const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const url = new URL(src);
    if (!base || !url.href.startsWith(`${base}/storage/v1/object/public/`)) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "error" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !res.body || !/image\/(jpeg|png)/.test(type)) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_OG_PHOTO_BYTES) return null;
    const buf = await readCapped(res.body, MAX_OG_PHOTO_BYTES);
    return buf ? dataUrl(buf, type) : null;
  } catch {
    return null;
  }
}

const MAX_OG_PHOTO_BYTES = 5 * 1024 * 1024;

async function readCapped(body: ReadableStream<Uint8Array>, max: number): Promise<Buffer | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
