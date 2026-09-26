import "server-only";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Product photos uploaded in the admin screen.
//
//   SUPABASE_URL + SUPABASE_SECRET_KEY set → Supabase Storage, public bucket "products"
//                                            (works on the hosted site; served from Mumbai).
//   Not set → public/products/<slug>/ on this computer (development only).
//
// Every upload gets a new file name, so browsers and the image optimiser never show an old photo.

const BUCKET = "products";
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
// Uploads go through a Server Action, whose body limit (next.config.ts) is 4 MB too.
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** The real image type from the file's first bytes (the browser's file.type is only a claim). */
export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const at = (i: number, bytes: number[]) => bytes.every((v, j) => b[i + j] === v);
  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp"; // RIFF....WEBP
  return null;
}

function storage() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}

export type PhotoResult = { ok: true; src: string } | { ok: false; message: string };

export async function saveProductPhoto(slug: string, file: File): Promise<PhotoResult> {
  if (!TYPES[file.type]) return { ok: false, message: "The photo must be a JPG, PNG or WebP." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, message: "The photo is too big. Pick one under 4 MB." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { ok: false, message: "The photo must be a JPG, PNG or WebP." };
  const name = `front-${Date.now().toString(36)}.${TYPES[type]}`;

  const s = storage();
  if (s) {
    const path = `${slug}/${name}`;
    const res = await fetch(`${s.url}/storage/v1/object/${BUCKET}/${path}`, { signal: AbortSignal.timeout(20_000),
      method: "POST",
      headers: {
        apikey: s.key,
        Authorization: `Bearer ${s.key}`,
        "Content-Type": type,
        "Cache-Control": "max-age=31536000", // the name never changes content
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!res.ok) {
      console.error("[photos] upload failed", res.status, (await res.text()).slice(0, 200));
      return { ok: false, message: "The photo couldn't be uploaded. Please try again." };
    }
    return { ok: true, src: `${s.url}/storage/v1/object/public/${BUCKET}/${path}` };
  }

  const dir = join(process.cwd(), "public", "products", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), bytes);
  return { ok: true, src: `/products/${slug}/${name}` };
}
