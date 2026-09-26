import type { Order } from "./orders";

// The order steps staff move a paid order through, one at a time and only forwards:
// paid → packed → ready at the counter / out for delivery → collected / delivered.

export type OrderStep = "packed" | "ready" | "completed";

export const ORDER_STEPS: OrderStep[] = ["packed", "ready", "completed"];

/** Why this step can't happen now, or null when it can. */
export function stepProblem(o: Order, step: string): string | null {
  if (!ORDER_STEPS.includes(step as OrderStep)) return "Unknown step.";
  if (o.kind === "gift_card" || o.gift?.status === "converted") return "This is a digital gift card. Nothing to pack.";
  if (o.gift?.mode === "pick" && (o.gift.status === "sent" || o.gift.status === "opened")) return "Waiting for the receiver to pick a size.";
  if (step === "packed") return o.status === "paid" && !o.packedAt ? null : "Only a paid order that isn't packed yet can be packed.";
  if (step === "ready") return o.status === "paid" && o.packedAt ? null : "Pack the order first.";
  return o.status === "ready_for_pickup" || o.status === "out_for_delivery" ? null : "The order has to be ready or out for delivery first.";
}

export const nextStepAllowed = (o: Order, step: string) => stepProblem(o, step) === null;

/** Where the pieces go: the receiver's choice for a gift, otherwise the buyer's. */
export const fulfilmentMethod = (o: Order) => o.gift?.receiver?.method ?? o.method;
