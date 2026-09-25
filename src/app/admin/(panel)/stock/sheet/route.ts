import { allProducts } from "@/lib/catalogue";
import { bySize } from "@/lib/inventory";
import { currentStaff } from "@/lib/staff";

const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** Every size as a CSV to count against: SKU, piece, colour, size, system count, and an empty "counted" column. */
export async function GET() {
  if (!(await currentStaff())) return new Response("Sign in first.", { status: 401 });
  const products = (await allProducts()).filter((p) => p.status !== "archived");
  const rows = [["sku", "counted", "piece", "colour", "size", "system"]];
  for (const p of products) for (const v of [...p.variants].sort(bySize)) rows.push([v.sku, "", p.name, v.colour, v.size, String(v.stock)]);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(rows.map((r) => r.map(cell).join(",")).join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="easypick-stock-count-${date}.csv"`, "Cache-Control": "no-store" },
  });
}
