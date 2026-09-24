import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";

// Webhook for the Store API / admin panel: call after a product or drop changes
// so pages refresh instantly instead of waiting for the 5-minute revalidate.
//
//   POST /api/revalidate
//   Authorization: Bearer <REVALIDATE_SECRET>
//   { "product": "oversized-heavy-tee" }  or  { "drop": "07" }  or  {}

function authorised(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(req: Request) {
  if (!authorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { product?: string; drop?: string };
  if (body.product) revalidatePath(`/product/${body.product}`);
  if (body.drop) revalidatePath(`/drop/${body.drop}`);
  // Listings show every product, so refresh them on any change.
  revalidatePath("/");
  revalidatePath("/drops");
  revalidatePath("/shop");
  if (!body.product && !body.drop) revalidatePath("/", "layout");

  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
