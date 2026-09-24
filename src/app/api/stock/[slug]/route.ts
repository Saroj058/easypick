import { getLiveStock } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Live stock by size for one product. Polled by the product page every 30s. */
export async function GET(_req: Request, ctx: RouteContext<"/api/stock/[slug]">) {
  const { slug } = await ctx.params;
  const stock = await getLiveStock(slug);
  if (!stock) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(stock, { headers: { "Cache-Control": "no-store" } });
}
