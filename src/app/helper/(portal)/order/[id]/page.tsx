import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NextStep, statusLabel, time } from "@/app/admin/(panel)/orders/order-bits";
import { ExchangeForm, type ExchangeLine } from "@/app/admin/(panel)/orders/[id]/order-tools";
import { findProduct } from "@/lib/catalogue";
import { requestTime } from "@/lib/format";
import { helperEvents } from "@/lib/helper-view";
import { findOrder, refundedQty } from "@/lib/orders";
import { currentStaff, requireStaff } from "@/lib/staff";
import { HelperOrderCard } from "../../queue";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/helper/order/[id]">): Promise<Metadata> {
  if (!(await currentStaff())) return { title: "Order" };
  return { title: (await findOrder((await params).id))?.number ?? "Order" };
}

const sizeText = (s: string) => (s === "ONE" ? "One size" : s);

/** One order for a helper: what to do next, a size exchange, and what's happened so far. */
export default async function HelperOrder({ params }: PageProps<"/helper/order/[id]">) {
  await requireStaff("/helper/login");
  const o = await findOrder((await params).id);
  if (!o) notFound();
  const done = refundedQty(o);
  const live = ["paid", "ready_for_pickup", "out_for_delivery", "completed"].includes(o.status);
  const products = await Promise.all([...new Set(o.lines.map((l) => l.slug))].map(findProduct));
  const exchangeLines: ExchangeLine[] = o.lines.flatMap((l, i) => {
    const p = products.find((x) => x?.slug === l.slug);
    if (!p || done[i] >= l.qty) return [];
    const options = p.variants.filter((v) => v.sku !== l.sku).map((v) => ({ sku: v.sku, label: `${v.colour} ${sizeText(v.size)}`, stock: v.stock }));
    return options.length ? [{ i, name: l.name, current: `${l.colour} ${sizeText(l.size)}`, options }] : [];
  });
  const windowDays = o.gift ? 14 : 7;
  const pastWindow = requestTime() - Date.parse(o.completedAt ?? o.paidAt ?? o.createdAt) > windowDays * 86_400_000;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/helper" className="text-[14px] text-steel-dark underline underline-offset-2">
        All orders
      </Link>
      <p className="mt-3 text-[14px] text-steel-dark">{statusLabel(o)}</p>
      <ul className="mt-2">
        <HelperOrderCard o={o} />
      </ul>
      {!live && (
        <div className="mt-4">
          <NextStep order={o} />
        </div>
      )}

      {live && exchangeLines.length > 0 && (
        <div className="mt-10 border-t border-mist pt-8">
          <ExchangeForm key={(o.events ?? []).length} orderId={o.id} lines={exchangeLines} windowDays={windowDays} pastWindow={pastWindow} />
          <p className="mt-3 text-[13px] text-steel-dark">Want money back instead? That&apos;s a refund: ask the owner.</p>
        </div>
      )}

      {o.gift?.message && (
        <section aria-labelledby="card-h" className="mt-10 border-t border-mist pt-6">
          <h2 id="card-h" className="text-lg font-semibold">
            Gift card message
          </h2>
          <p className="mt-2 border-l-2 border-mist pl-3">&ldquo;{o.gift.message}&rdquo;</p>
          <p className="mt-1 text-[14px] text-steel-dark">From {o.gift.senderName ?? "someone (anonymous)"}. It&apos;s printed on the slip.</p>
        </section>
      )}

      <section aria-labelledby="ev-h" className="mt-10 border-t border-mist pt-6">
        <h2 id="ev-h" className="text-lg font-semibold">
          What&apos;s happened
        </h2>
        <ol className="mt-3 space-y-2 text-[14px]">
          {/* Fulfilment only: refunds and payment details are for the owner. */}
          {[...helperEvents(o.events)].reverse().map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-28 shrink-0 text-steel-dark">{time.format(new Date(e.at))}</span>
              <span>
                {e.what} <span className="text-steel-dark">· {e.by}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
