// What the order page may say about a payment problem. Links carry only one of these
// codes (?pay=failed&why=<code>), never free text, so nobody can craft a link that puts
// their own words ("pay on WhatsApp to 98…") on an Easypick page.

export const PAY_MESSAGES = {
  cancelled: "The payment was cancelled or didn't go through. Your pieces are still held for a few minutes.",
  not_complete: "The wallet hasn't confirmed the payment yet. If money left your account, it will show here within a few minutes.",
  bad_reply: "We couldn't confirm that payment. If money left your account, contact us with your order number.",
  no_order: "We couldn't match that payment to an order. Contact us with your order number.",
  amount: "The amount paid doesn't match the order. We've told the team; they'll sort it out.",
  unavailable: "That wallet isn't available right now.",
  unreachable: "We couldn't reach the wallet to confirm. If you paid, it will show here within a few minutes.",
  start_failed: "The wallet didn't start the payment. Try again in a moment.",
  too_many: "This order has had too many payment tries. If money left your account, contact us with your order number; otherwise place the order again.",
  time_up: "The hold on this order is about to end, so there isn't time to pay safely. Wait a minute for it to end, then place the order again.",
} as const;

export type PayCode = keyof typeof PAY_MESSAGES;

export const payMessage = (code: unknown) => (typeof code === "string" && code in PAY_MESSAGES ? PAY_MESSAGES[code as PayCode] : PAY_MESSAGES.cancelled);
