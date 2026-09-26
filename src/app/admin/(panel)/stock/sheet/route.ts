import { allProducts } from "@/lib/catalogue";
import { bySize } from "@/lib/inventory";
import { ktmDay } from "@/lib/ktm-day";
import { currentStaff } from "@/lib/staff";

// No formula guard here (unlike the orders CSV): this sheet is pasted back into the stock count,
// which reads the SKU and count as they are. Names are the owner's own product names.
const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/**
 * Every size as a CSV to count against: SKU, piece, colour, size, system count, and an empty "counted" column.
 * Starts with a BOM so Excel shows names in UTF-8; the stock count trims it off the first line.
 */
export async function GET() {
  if (!(await currentStaff())) return new Response("Sign in first.", { status: 401 });
  const products = (await allProducts()).filter((p) => p.status !== "archived");
  const rows = [["sku", "counted", "piece", "colour", "size", "system"]];
  for (const p of products) for (const v of [...p.variants].sort(bySize)) rows.push([v.sku, "", p.name, v.colour, v.size, String(v.stock)]);
  const date = ktmDay();
  return new Response("\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="easypick-stock-count-${date}.csv"`, "Cache-Control": "no-store" },
  });
}
