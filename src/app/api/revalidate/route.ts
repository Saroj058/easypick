import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";

// Webhook for the Store API / admin panel: call after a product or drop changes
// so pages refresh instantly instead of waiting for the 5-minute revalidate.
//
//   POST /api/revalidate
//   Authorization: Bearer <REVALIDATE_SECRET>
//   { "product": "oversized-heavy-tee" }  or  { "drop": "07" }  or  {}

const digest = (s: string) => createHash("sha256").update(s).digest();
const SLUG = /^[a-z0-9-]{1,80}$/;

function authorised(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret) return false;
  // Same-length digests: the comparison takes the same time whatever was sent.
  return timingSafeEqual(digest(given), digest(secret));
}

export async function POST(req: Request) {
  if (!authorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { product?: unknown; drop?: unknown } | null;
  const product = body?.product;
  const drop = body?.drop;
  if ((product !== undefined && (typeof product !== "string" || !SLUG.test(product))) || (drop !== undefined && (typeof drop !== "string" || !SLUG.test(drop)))) {
    return Response.json({ error: "product and drop must be slugs (a-z, 0-9, -)" }, { status: 400 });
  }
  if (product) revalidatePath(`/product/${product}`);
  if (drop) revalidatePath(`/drop/${drop}`);
  // Listings show every product, so refresh them on any change.
  revalidatePath("/");
  revalidatePath("/drops");
  revalidatePath("/shop");
  if (!product && !drop) revalidatePath("/", "layout");

  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
