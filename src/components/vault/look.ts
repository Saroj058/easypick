// The Vault's cold palette (owner, 18 Oct 2026, from the FRZN reference): a frost-blue page, a
// slate panel, pale ice tiles. Every text pairing below passes WCAG AA for its size.
//   frost  #aec4d8  the page around the panel; headlines on it in DEEP (large text only), small text in INK
//   slate  #4b6680  the panel; text on it in white or ICE_DIM (4.5:1)
//   tile   #c3d4e4  the ground a piece stands on; text on it in INK

export const V = {
  frost: "bg-[#aec4d8]",
  slate: "bg-[#4b6680]",
  tile: "bg-[#c3d4e4]",
  /** Headlines on frost (large text). */
  deep: "text-[#3d566e]",
  /** Small text on frost or on a tile. */
  ink: "text-[#1f3347]",
  /** Quiet text on slate. */
  iceDim: "text-[#d5e2ee]",
  mono: "font-mono text-[10.5px] uppercase tracking-[0.16em]",
} as const;

/** A tile with two corners cut, like the reference's inventory cards. */
export const NOTCH = "[clip-path:polygon(0_0,calc(100%-18px)_0,100%_18px,100%_100%,18px_100%,0_calc(100%-18px))]";

export const two = (n: number) => String(n).padStart(2, "0");
