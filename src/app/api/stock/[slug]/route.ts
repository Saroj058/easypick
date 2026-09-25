import { getLiveStock } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Live stock by size for one product, polled by open product pages. The CDN may share one
 * answer for 10 seconds; checkout checks stock again in the database, so this is display only.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/stock/[slug]">) {
  const { slug } = await ctx.params;
  const stock = await getLiveStock(slug);
  if (!stock) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(stock, { headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=20" } });
}
