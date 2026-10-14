import { getProduct } from "@/lib/store";

// One piece in full, for a form opened over a page (the gift page's "Send it as a gift" pop-up).
// Only pieces on sale: the same rule as the send-as-gift page.
export const revalidate = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const product = await getProduct((await params).slug);
  if (!product || product.status !== "live") return Response.json(null, { status: 404 });
  return Response.json(product);
}
