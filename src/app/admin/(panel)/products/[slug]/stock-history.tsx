import type { stockHistory } from "@/lib/catalogue";
import { site } from "@/lib/site";

const when = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const reasonLabel: Record<string, string> = {
  order_hold: "Online order",
  order_release: "Order expired / released",
  received: "Received",
  count: "Count correction",
  damaged: "Damaged or lost",
  returned: "Returned",
  exchange_in: "Exchange (back in)",
  exchange_out: "Exchange (out)",
  gift_swap: "Gift size swap",
  refund_restock: "Refund, back in stock",
};

/** Every stock change for a product, newest first: who, why and what it left. */
export function StockHistory({ history }: { history: Awaited<ReturnType<typeof stockHistory>> }) {
  return (
    <section aria-labelledby="hist-h" className="border-t border-mist pt-8">
      <h3 id="hist-h" className="text-lg font-semibold">
        Stock history
      </h3>
      {history.length === 0 ? (
        <p className="mt-2 text-[14px] text-steel-dark">No changes recorded yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[14px]">
            <thead className="text-[12px] text-steel-dark">
              <tr className="border-b border-mist">
                <th className="py-2 font-normal">When</th>
                <th className="py-2 font-normal">Size</th>
                <th className="py-2 text-right font-normal">Change</th>
                <th className="py-2 text-right font-normal">After</th>
                <th className="py-2 pl-4 font-normal">Why</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-b border-mist">
                  <td className="py-2 text-steel-dark">{when.format(new Date(h.at))}</td>
                  <td className="py-2 font-mono">{h.sku}</td>
                  <td className={`py-2 text-right font-mono tabular-nums ${h.delta > 0 ? "text-[#1f7a3d]" : ""}`}>{h.delta > 0 ? `+${h.delta}` : h.delta}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{h.stockAfter ?? ""}</td>
                  <td className="py-2 pl-4">
                    {reasonLabel[h.reason] ?? h.reason}
                    {h.ref ? <span className="text-steel-dark"> · {h.ref}</span> : null}
                    {h.actor ? <span className="text-steel-dark"> · {h.actor}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
