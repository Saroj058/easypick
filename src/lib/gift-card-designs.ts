// The three launch designs for Easypick gift cards. Every card shares one layout: logo top
// left, the artwork, the amount bottom left, "Gift card" bottom right. Birthday, Sneaker and
// the Dashain/Tihar designs join later (see the gift card plan).

export const GIFT_CARD_DESIGNS = [
  { id: "pick", name: "Pick It", note: "Black, big type" },
  { id: "flatlay", name: "Flat Lay", note: "A tee, laid flat" },
  { id: "lime", name: "Lime", note: "Loud and bright" },
] as const;

export type GiftCardDesign = (typeof GIFT_CARD_DESIGNS)[number]["id"];

export const isGiftCardDesign = (v: unknown): v is GiftCardDesign => GIFT_CARD_DESIGNS.some((d) => d.id === v);

/** Colours per design, shared by the page and the email. */
export const DESIGN_COLOURS: Record<GiftCardDesign, { bg: string; ink: string; accent: string }> = {
  pick: { bg: "#0a0a0a", ink: "#ffffff", accent: "#c6ff3d" },
  flatlay: { bg: "#f2f2f2", ink: "#0a0a0a", accent: "#0a0a0a" },
  lime: { bg: "#c6ff3d", ink: "#0a0a0a", accent: "#0a0a0a" },
};

/** Email can't draw the card art, so each design gets its big word (Flat Lay's tee becomes "TEE"). */
const BIG_WORD: Record<GiftCardDesign, string> = { pick: "PICK", flatlay: "TEE", lime: "e" };

/** The card as an email block: the design's colours and big word, the amount, then the code. */
export function giftCardEmailBlock(opts: { design?: string; amount: string; code: string }) {
  const design: GiftCardDesign = isGiftCardDesign(opts.design) ? opts.design : "pick";
  const c = DESIGN_COLOURS[design];
  // Tables and bgcolor only (no float or flex), so Outlook draws it too.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.bg}" style="margin:0 0 16px;background:${c.bg};border-radius:12px"><tr><td colspan="2" style="padding:22px 24px 8px;color:${c.ink};font-weight:700;font-size:16px">easypick</td></tr>
<tr><td colspan="2" align="right" style="padding:0 24px;color:${c.ink};font-family:'Barlow Condensed',Impact,'Arial Narrow',sans-serif;font-weight:700;font-size:88px;line-height:0.9;letter-spacing:-0.02em">${BIG_WORD[design]}</td></tr>
<tr><td style="padding:10px 0 22px 24px;color:${c.ink};font-family:ui-monospace,Menlo,Consolas,monospace;font-size:22px;font-weight:700">${opts.amount}</td><td align="right" style="padding:10px 24px 22px 0;color:${c.ink};font-size:13px">Gift card</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a0a0a" style="margin:0 0 24px;background:#0a0a0a"><tr><td style="padding:18px 22px;color:#ffffff;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:24px;font-weight:700;letter-spacing:0.1em">${opts.code}</td></tr></table>`;
}
