import Image from "next/image";

import { DESIGN_COLOURS, type GiftCardDesign } from "@/lib/gift-card-designs";
import { formatPrice } from "@/lib/format";
import { GarmentSvg } from "./product-image";

const NAMES: Record<GiftCardDesign, string> = { pick: "Pick It", flatlay: "Flat Lay", lime: "Lime" };

/** The amounts that have a printed card of their own: the owner's artwork, with the amount on it. */
export const PRINTED_CARDS = [1000, 2000, 5000, 10000, 15000, 20000, 25000, 30000, 50000] as const;
/** Each picture's own size in pixels, so a card is shown whole, at its own shape, never cropped. */
const SIZES: Record<number | "back", [number, number]> = {
  1000: [433, 239],
  2000: [462, 239],
  5000: [458, 239],
  10000: [360, 231],
  15000: [333, 229],
  20000: [344, 230],
  25000: [350, 231],
  30000: [459, 239],
  50000: [470, 239],
  back: [1128, 622],
};

/**
 * The gift card as it is printed. An amount with a card of its own shows that card; any other
 * amount shows the plain black Easypick card with the amount set on it. `side="back"` is the
 * back every card shares.
 */
export function GiftCardPicture({ amount, side = "front", className = "", priority, fill }: { amount: number | null; side?: "front" | "back"; className?: string; priority?: boolean; /** Take the size of the box around it instead of the picture's own shape. */ fill?: boolean }) {
  const printed = side === "front" && amount !== null && (PRINTED_CARDS as readonly number[]).includes(amount);
  const [w, h] = SIZES[printed ? (amount as number) : "back"];
  return (
    <div
      className={`relative w-full overflow-hidden bg-ink text-paper [container-type:inline-size] ${fill ? "h-full" : ""} shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] ${className}`}
      style={{ borderRadius: "4.5% / 8%" }}
      role="img"
      aria-label={side === "back" ? "The back of an Easypick gift card" : `Easypick gift card${amount ? `, ${formatPrice(amount)}` : ""}`}
    >
      <Image src={printed ? `/gift-cards/front-${amount}.webp` : "/gift-cards/back.webp"} alt="" width={w} height={h} sizes="(min-width: 1024px) 420px, 340px" priority={priority} className={fill ? "absolute inset-0 h-full w-full object-cover" : "block h-auto w-full"} />
      {!printed && side === "front" && amount ? (
        <>
          <p className="absolute font-semibold uppercase leading-none tracking-[0.2em]" style={{ right: "6cqw", top: "7cqw", fontSize: "2.8cqw" }}>
            Gift card
          </p>
          <p className="absolute font-semibold leading-none" style={{ left: "7cqw", bottom: "7cqw", fontSize: "8cqw" }}>
            {formatPrice(amount).replace("Rs ", "Rs. ")}
          </p>
        </>
      ) : null}
    </div>
  );
}

/**
 * An Easypick gift card at credit-card proportions (85.6 × 54 mm). Same layout on every
 * design: logo top left, artwork full bleed, amount bottom left, "Gift card" bottom right.
 * Everything is sized from the card's own width (cqw), so a thumbnail looks like the card.
 */
export function GiftCardArt({ design, amount, className = "" }: { design: GiftCardDesign; amount: number | null; className?: string }) {
  const c = DESIGN_COLOURS[design];
  const dark = design === "pick";
  return (
    <div
      className={`relative aspect-[1.586/1] w-full overflow-hidden [container-type:inline-size] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] ${className}`}
      // Corner radius as a share of the card (a card can't measure itself in cqw): about 4.5% of its width.
      style={{ background: c.bg, color: c.ink, borderRadius: "4.5% / 7.1%" }}
      role="img"
      aria-label={`Easypick gift card, ${NAMES[design]} design${amount ? `, ${formatPrice(amount)}` : ""}`}
    >
      {design === "pick" && (
        <>
          {/* PICK, huge, cropped off the right edge */}
          <span className="display absolute leading-[0.8] tracking-tight" style={{ fontSize: "36cqw", right: "-7cqw", top: "15cqw" }} aria-hidden>
            PICK
          </span>
          <span className="absolute rounded-full" style={{ background: c.accent, width: "3cqw", height: "3cqw", right: "7cqw", top: "7cqw" }} aria-hidden />
        </>
      )}
      {design === "flatlay" && (
        <span className="absolute" style={{ right: "3cqw", top: "5cqw", width: "54cqw", height: "46cqw" }} aria-hidden>
          <GarmentSvg category="tees" colourHex="#111111" className="h-full w-full" />
        </span>
      )}
      {design === "lime" && (
        /* A big rounded e, cropped off the top-right corner */
        <span className="display absolute normal-case leading-none" style={{ fontSize: "82cqw", right: "-9cqw", top: "-27cqw" }} aria-hidden>
          e
        </span>
      )}
      <Image src={dark ? "/brand/logo-white.png" : "/brand/logo.png"} alt="" width={611} height={161} className="absolute h-auto" style={{ left: "6cqw", top: "6cqw", width: "25cqw" }} />
      {amount ? (
        <p className="absolute font-mono font-semibold leading-none" style={{ left: "6cqw", bottom: "6cqw", fontSize: "7cqw" }}>
          {formatPrice(amount)}
        </p>
      ) : null}
      <p className="absolute font-semibold leading-none" style={{ right: "6cqw", bottom: "6.5cqw", fontSize: "3.4cqw" }}>
        Gift card
      </p>
    </div>
  );
}
