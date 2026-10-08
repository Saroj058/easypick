import Link from "next/link";

import { GiftCardArt } from "@/components/gift-card-art";

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** A wrapped parcel with a ribbon, a bow and a tag on a string, drawn in CSS. */
function Parcel() {
  return (
    <div aria-hidden className="relative h-[150px] w-[170px] transition-transform duration-500 ease-out group-hover:-translate-y-1.5 group-hover:-rotate-2 md:h-[176px] md:w-[200px]">
      {/* the lid and the box */}
      <div className="absolute inset-x-0 bottom-0 top-[22%] rounded-[3px] bg-paper shadow-[0_24px_40px_-20px_rgba(0,0,0,0.9)]" />
      <div className="absolute inset-x-[-5%] top-[14%] h-[16%] rounded-[3px] bg-[#e9e8e3] shadow-[0_4px_10px_-6px_rgba(0,0,0,0.6)]" />
      {/* the ribbon, both ways */}
      <div className="absolute bottom-0 left-1/2 top-[14%] w-[12%] -translate-x-1/2 bg-ink" />
      <div className="absolute inset-x-0 top-[56%] h-[11%] bg-ink" />
      {/* the bow */}
      <div className="absolute left-1/2 top-[-5%] h-[19%] w-[26%] -translate-x-[95%] -rotate-[24deg] rounded-[50%] border-[6px] border-ink" />
      <div className="absolute left-1/2 top-[-5%] h-[19%] w-[26%] -translate-x-[5%] rotate-[24deg] rounded-[50%] border-[6px] border-ink" />
      {/* the tag, hanging off the ribbon on its string */}
      <div className="absolute right-[-30%] top-[60%] flex origin-top-left rotate-[-8deg] items-start transition-transform duration-500 group-hover:rotate-[4deg]">
        <span className="mt-[6px] h-px w-6 bg-paper/70" />
        <span className="hang-tag w-[74px] px-2 pb-2 pt-5 text-center font-mono [--hole:var(--color-ink)] before:top-[8px] before:-ml-1 before:h-2 before:w-2">
          <span className="block text-[9px] uppercase tracking-[0.12em] text-steel-dark">For</span>
          <span className="block text-[13px] font-semibold leading-tight">you</span>
          <span className="mt-1 block text-[8px] uppercase tracking-[0.1em] text-steel-dark">Size: yours</span>
        </span>
      </div>
    </div>
  );
}

/**
 * "Buying for someone?": two ways in, each with its own picture. A gift is a wrapped parcel
 * (they choose the size when it reaches them); a gift card is the card itself, two designs
 * fanned out. Each tile is one link.
 */
export function GiftBlock() {
  return (
    <div>
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">Gifts</p>
          <h2 id="gift-title" className="display mt-2 text-[clamp(2.25rem,1.6rem+2.4vw,3.75rem)] leading-[0.92]">
            Buying for someone?
          </h2>
        </div>
        <p className="max-w-sm text-[15px] text-steel-dark md:text-right">Nobody guesses a size. They pick it when the gift reaches them.</p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {/* Send a gift */}
        <Link href="/gift" className="on-dark group relative flex min-h-[300px] flex-col justify-between overflow-hidden bg-ink p-6 text-paper md:p-8">
          <div className="relative z-10 lg:max-w-[55%]">
            <h3 className="display text-[40px] leading-[0.9] md:text-[48px]">Send a gift</h3>
            <p className="mt-3 text-[15px] text-paper/75">You pay. We send them a link. They choose the size and how to get it.</p>
            <ol className="mt-5 grid gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-paper/60">
              <li>01 Pick a piece</li>
              <li>02 Their email</li>
              <li>03 They pick the size</li>
            </ol>
          </div>
          {/* The parcel: under the words on smaller screens, beside them on wide ones */}
          <div className="pointer-events-none relative mt-8 flex justify-center pr-10 lg:absolute lg:bottom-10 lg:right-[14%] lg:mt-0 lg:pr-0">
            <Parcel />
          </div>
          <span className="relative z-10 mt-8 inline-flex h-12 w-fit items-center gap-2 rounded-full bg-paper px-6 text-[14px] font-semibold uppercase tracking-[0.06em] text-ink lg:mt-6">
            Send a gift <Arrow />
          </span>
        </Link>

        {/* Gift cards */}
        <Link href="/gift-cards" className="group relative flex min-h-[300px] flex-col justify-between overflow-hidden border border-ink bg-photo p-6 md:p-8">
          <div className="relative z-10 lg:max-w-[52%]">
            <h3 className="display text-[40px] leading-[0.9] md:text-[48px]">Gift cards</h3>
            <p className="mt-3 text-[15px] text-steel-dark">Any amount from Rs 1,000 to 20,000. Sent by email or SMS, spent online or in the store.</p>
            <p className="mt-5 flex flex-wrap gap-1.5 font-mono text-[12px] tabular-nums">
              {["1,000", "2,500", "5,000", "10,000"].map((a) => (
                <span key={a} className="rounded-full border border-ink/25 bg-paper px-2.5 py-1">
                  Rs {a}
                </span>
              ))}
            </p>
          </div>
          {/* Two designs, fanned: under the words on smaller screens, beside them on wide ones */}
          <div aria-hidden className="pointer-events-none relative mx-auto mt-10 w-[68%] max-w-[260px] lg:absolute lg:right-8 lg:top-[54%] lg:mx-0 lg:mt-0 lg:w-[40%] lg:-translate-y-1/2">
            <div className="relative">
              <GiftCardArt design="flatlay" amount={null} className="absolute inset-0 translate-x-[10%] translate-y-[-14%] rotate-[10deg] transition-transform duration-500 group-hover:translate-x-[16%] group-hover:rotate-[14deg]" />
              <GiftCardArt design="pick" amount={2500} className="relative -rotate-[6deg] transition-transform duration-500 group-hover:-translate-y-1 group-hover:-rotate-[9deg]" />
            </div>
          </div>
          <span className="relative z-10 mt-8 inline-flex h-12 w-fit items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold uppercase tracking-[0.06em] text-paper lg:mt-6">
            Choose a card <Arrow />
          </span>
        </Link>
      </div>
    </div>
  );
}
