import { offerStacks, type OfferSummary } from "@/lib/offer-rules";
import { OfferStack } from "./offer-stack";

/**
 * The festival offers as three stacks of cards side by side (owner, 18 Oct 2026): left, middle and
 * right, each its own group (festivals, by price, by kind) with up to three offers in it. On a
 * phone the stacks slide sideways, one at a time.
 */
export function OfferStacks({ offers, start }: { offers: OfferSummary[]; start?: string }) {
  const stacks = offerStacks(offers);
  if (!stacks.length) return null;
  return (
    <ul className={`no-scrollbar -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 lg:mx-0 lg:grid lg:gap-4 lg:overflow-visible lg:px-0 ${stacks.length === 1 ? "lg:grid-cols-1" : stacks.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
      {stacks.map((s) => (
        <li key={s.group} className="w-[86vw] max-w-[420px] shrink-0 snap-center lg:w-auto lg:max-w-none">
          <p className="mb-5 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">{s.group}</p>
          <OfferStack offers={s.offers} label={s.group} start={s.offers.some((x) => x.offer.id === start) ? start : undefined} />
        </li>
      ))}
    </ul>
  );
}
