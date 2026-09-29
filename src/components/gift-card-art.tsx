import Image from "next/image";

import { DESIGN_COLOURS, type GiftCardDesign } from "@/lib/gift-card-designs";
import { formatPrice } from "@/lib/format";
import { GarmentSvg } from "./product-image";

const NAMES: Record<GiftCardDesign, string> = { pick: "Pick It", flatlay: "Flat Lay", lime: "Lime" };

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
