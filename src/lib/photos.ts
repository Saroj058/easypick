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
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function storage() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}

export type PhotoResult = { ok: true; src: string } | { ok: false; message: string };

export async function saveProductPhoto(slug: string, file: File): Promise<PhotoResult> {
  const ext = TYPES[file.type];
  if (!ext) return { ok: false, message: "The photo must be a JPG, PNG or WebP." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, message: "The photo must be under 8 MB." };
  const name = `front-${Date.now().toString(36)}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const s = storage();
  if (s) {
    const path = `${slug}/${name}`;
    const res = await fetch(`${s.url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: s.key,
        Authorization: `Bearer ${s.key}`,
        "Content-Type": file.type,
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
