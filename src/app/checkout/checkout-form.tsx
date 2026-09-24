"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { placeOrder, type CheckoutState } from "@/app/actions";
import { previewGiftCard } from "@/app/gift-actions";
import { useBag } from "@/components/bag-provider";
import { useMe, usePrefilled } from "@/components/session";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import type { FulfilmentMethod } from "@/lib/types";

const providers = [
  { value: "esewa", label: "eSewa" },
  { value: "khalti", label: "Khalti" },
  { value: "fonepay", label: "Fonepay" },
];

function Option({ name, value, checked, onChange, title, note }: { name: string; value: string; checked: boolean; onChange: () => void; title: string; note?: string }) {
  return (
    <label className="relative block cursor-pointer">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="peer sr-only" required />
      <span className="flex min-h-[64px] flex-col justify-center rounded-[2px] border border-mist px-4 py-3 peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
        <span className="font-semibold">{title}</span>
        {note && <span className="text-[13px] text-steel-dark">{note}</span>}
      </span>
    </label>
  );
}

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 text-base outline-none focus:border-ink";

export function CheckoutForm() {
  const { lines, ready, subtotal } = useBag();
  const me = useMe();
  const phoneField = usePrefilled(me?.phone);
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, { status: "idle" });
  const [method, setMethod] = useState<FulfilmentMethod>("pickup");
  const [provider, setProvider] = useState("esewa");
  const [cardOpen, setCardOpen] = useState(false);
  const [cardCode, setCardCode] = useState("");
  const [card, setCard] = useState<{ code: string; balance: number } | null>(null);
  const [cardMsg, setCardMsg] = useState("");

  async function applyCard() {
    setCardMsg("");
    const res = await previewGiftCard(cardCode);
    if (res.ok) setCard({ code: res.code, balance: res.balance });
    else {
      setCard(null);
      setCardMsg(res.message);
    }
  }

  if (!ready) return <div className="mt-10 h-96" aria-hidden />;

  if (lines.length === 0) {
    return (
      <div className="mt-10">
        <p className="text-steel-dark">Your bag is empty.</p>
        <Link href="/shop" className="btn btn-volt mt-6">
          Shop all
        </Link>
      </div>
    );
  }

  const deliveryFee = method === "delivery" && subtotal < site.delivery.freeAbove ? site.delivery.flatFee : 0;
  const err = state.status === "error" ? state : null;
  const cardApplied = card ? Math.min(card.balance, subtotal + deliveryFee) : 0;
  const toPay = subtotal + deliveryFee - cardApplied;

  return (
    <form action={action} className="mt-10 space-y-12" noValidate>
      <input type="hidden" name="bag" value={JSON.stringify(lines)} />
      <input type="hidden" name="giftCard" value={card?.code ?? ""} />

      <section aria-labelledby="co-phone">
        <h2 id="co-phone" className="display text-[28px]">
          1. Your number
        </h2>
        <label htmlFor="phone" className="mt-4 block text-sm font-semibold">
          Mobile number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98XXXXXXXX"
          required
          {...phoneField}
          aria-invalid={err?.field === "phone"}
          className={`${input} font-mono`}
        />
        <p className="mt-2 text-[13px] text-steel-dark">
          Order updates come by SMS.{" "}
          {me === null && (
            <>
              No account needed, or{" "}
              <Link href="/login?next=/checkout" className="font-semibold text-ink underline underline-offset-2">
                log in
              </Link>{" "}
              to save this order to your account.
            </>
          )}
          {me && <>This order will be saved to your account.</>}
        </p>
      </section>

      <section aria-labelledby="co-method">
        <h2 id="co-method" className="display text-[28px]">
          2. Pickup or delivery
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="co-method">
          <Option name="method" value="pickup" checked={method === "pickup"} onChange={() => setMethod("pickup")} title="Store pickup" note="Free · ready the same day" />
          <Option
            name="method"
            value="delivery"
            checked={method === "delivery"}
            onChange={() => setMethod("delivery")}
            title="Delivery"
            note={`Kathmandu Valley · ${subtotal >= site.delivery.freeAbove ? "Free" : formatPrice(site.delivery.flatFee)}`}
          />
        </div>
        {method === "delivery" && (
          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="area" className="block text-sm font-semibold">
                Area
              </label>
              <input id="area" name="area" autoComplete="address-level3" placeholder="e.g. Baneshwor, Kathmandu" required aria-invalid={err?.field === "area"} className={input} />
            </div>
            <div>
              <label htmlFor="landmark" className="block text-sm font-semibold">
                Nearby landmark
              </label>
              <input id="landmark" name="landmark" placeholder="e.g. opposite Big Mart" required className={input} />
            </div>
            <div>
              <label htmlFor="details" className="block text-sm font-semibold">
                House, floor or other directions <span className="font-normal text-steel-dark">(optional)</span>
              </label>
              <input id="details" name="details" autoComplete="address-line2" className={input} />
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="co-pay">
        <h2 id="co-pay" className="display text-[28px]">
          3. Pay
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-3" role="radiogroup" aria-labelledby="co-pay">
          {providers.map((p) => (
            <Option key={p.value} name="provider" value={p.value} checked={provider === p.value} onChange={() => setProvider(p.value)} title={p.label} />
          ))}
        </div>
      </section>

      <section aria-label="Order summary" className="border-t border-mist pt-6">
        <ul className="space-y-2 text-[15px]">
          {lines.map((l) => (
            <li key={l.sku} className="flex justify-between gap-4">
              <span>
                {l.name} <span className="text-steel-dark">· {l.colour} · {l.size === "ONE" ? "One size" : l.size} × {l.qty}</span>
              </span>
              <span className="shrink-0 font-mono">{formatPrice(l.price * l.qty)}</span>
            </li>
          ))}
          {method === "delivery" && (
            <li className="flex justify-between text-steel-dark">
              <span>Delivery</span>
              <span className="font-mono">{deliveryFee ? formatPrice(deliveryFee) : "Free"}</span>
            </li>
          )}
        </ul>
        {card && (
          <p className="mt-2 flex justify-between text-[15px] text-steel-dark">
            <span>Gift card {card.code}</span>
            <span className="font-mono">−{formatPrice(cardApplied)}</span>
          </p>
        )}
        <p className="mt-4 flex justify-between text-xl font-semibold">
          <span>Total</span>
          <span className="font-mono">{formatPrice(toPay)}</span>
        </p>

        <div className="mt-4">
          {!cardOpen && !card ? (
            <button type="button" onClick={() => setCardOpen(true)} className="min-h-11 text-[15px] font-semibold underline underline-offset-4">
              Have a gift card?
            </button>
          ) : card ? (
            <p className="text-[14px]">
              Gift card applied. {formatPrice(card.balance - cardApplied)} stays on the card.{" "}
              <button type="button" onClick={() => setCard(null)} className="min-h-11 underline">
                Remove
              </button>
            </p>
          ) : (
            <div>
              <label htmlFor="co-card" className="block text-sm font-semibold">
                Gift card code
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="co-card"
                  value={cardCode}
                  onChange={(e) => setCardCode(e.target.value)}
                  placeholder="EP-XXXX-XXXX"
                  autoCapitalize="characters"
                  className="h-[52px] min-w-0 flex-1 rounded-[2px] border border-steel-dark bg-paper px-4 font-mono uppercase"
                />
                <button type="button" onClick={applyCard} className="btn btn-ink shrink-0">
                  Apply
                </button>
              </div>
              <p role="alert" className="mt-1 min-h-5 text-[13px] text-error-light">
                {cardMsg}
              </p>
            </div>
          )}
        </div>
        <p className="mt-1 text-[13px] text-steel-dark">VAT included.</p>

        <p role="alert" className="mt-4 min-h-5 text-[14px] text-[#d70015]">
          {err?.message ?? ""}
        </p>

        <button type="submit" className="btn btn-volt mt-2 w-full" disabled={pending}>
          {pending ? "Placing order…" : toPay > 0 ? `Pay ${formatPrice(toPay)}` : "Place order"}
        </button>
        <p className="mt-3 text-[13px] text-steel-dark">
          Your order is confirmed only after {providers.find((p) => p.value === provider)?.label} confirms the payment with us. By paying you
          agree to our{" "}
          <Link href="/terms" className="underline">
            terms of sale
          </Link>
          .
        </p>
      </section>
    </form>
  );
}
