// One turn of the chat with Pick: what the customer did (a button or a typed message) in, Pick's
// answer out. The order is always the same: read the input, update what Pick knows, then either ask
// the next question or show products from the real catalogue. Facts (prices, delivery, sizes) are
// written here from the catalogue and site settings; the AI only ever adds a short warm line.

import { formatPrice } from "../format";
import { site } from "../site";
import type { Product } from "../types";
import { GREETING, KIND_WORDS, categoriesOf, forSelf, smallTalk, acknowledge, applySet, cleanState, question, readMessage, stageOf, type PickAction, type PickState, type Quick } from "./journey";
import { GOES_WITH, compare, giftable, recommend, type PickCard } from "./recommend";
import type { Understanding } from "./ai";

/** How the robot should look while this answer is on screen. */
export type Mood = "greeting" | "curious" | "happy" | "reassuring" | "speaking";

export interface PickMessage {
  text: string;
  cards?: PickCard[];
}

export interface PickReply {
  messages: PickMessage[];
  state: PickState;
  quick: Quick[];
  /** Show the number field for their own budget. */
  input?: "budget";
  mood: Mood;
  /** True when the AI read the message (so the page can say when it couldn't). */
  ai?: boolean;
}

export type PickInput = { start: true } | { quick: Quick } | { text: string };

const ACTIONS: PickAction[] = ["help-decide", "more", "cheaper", "restart", "change-budget", "change-style", "own-budget", "fit", "delivery", "compare", "skip", "pair", "change-kind", "gift", "any-colour"];

/** The shop's first words (and after "start again"). */
export const SHOP_HELLO = "Hey, I'm Pick! 👋";

const WORDS: Record<string, string> = {
  partner: "for someone special",
  friend: "for a friend",
  family: "for family",
  self: "for you",
  someone: "for someone",
  birthday: "a birthday",
  anniversary: "an anniversary",
  valentine: "Valentine's",
  festival: "the festival",
  thanks: "a thank-you",
  "just-because": "just because",
  other: "a special day",
  street: "streetwear",
  minimal: "minimal and clean",
  casual: "everyday casual",
  premium: "premium",
  bold: "something bold",
  unsure: "open on style",
  tees: "tees",
  hoodies: "hoodies",
  jackets: "jackets",
  bottoms: "bottoms",
  "co-ords": "co-ords",
  accessories: "accessories",
  any: "anything",
};

export async function turn(products: Product[], rawState: unknown, input: PickInput, understand?: (text: string, known: PickState) => Promise<Understanding | null>): Promise<PickReply> {
  const prices = giftable(products).map((p) => p.salePrice ?? p.price);
  if ("start" in input) {
    const q = question("recipient", {}, prices);
    return { messages: [{ text: `${GREETING} ${q.text}` }], state: {}, quick: q.quick, mood: "greeting" };
  }

  let s = cleanState(rawState);
  const lines: string[] = [];
  let set: NonNullable<Quick["set"]> = {};
  let action: PickAction | undefined;
  let usedAi = false;
  let mood: Mood = "curious";

  if ("quick" in input) {
    set = input.quick.set ?? {};
    action = input.quick.action && ACTIONS.includes(input.quick.action) ? input.quick.action : undefined;
  } else {
    const text = input.text.slice(0, 400);
    const plain = readMessage(text);
    // On the shop, "for me" is the starting point: a recipient other than themselves turns it into a gift.
    if (s.mode === "shop" && plain.set.recipient && plain.set.recipient !== "self") s = { ...s, gift: true };
    const ai = understand ? await understand(text, s) : null;
    if (s.mode === "shop" && ai?.set.recipient && ai.set.recipient !== "self") s = { ...s, gift: true };
    usedAi = Boolean(ai);
    // The AI's reading wins where it gave a value; the simple reading fills the rest.
    set = { ...plain.set, ...(ai?.set ?? {}) };
    action = ai?.action ?? plain.action;
    if (ai?.reply) lines.push(ai.reply);
    if (!Object.keys(set).length && !action && !ai?.reply) {
      // Small talk gets a real answer; anything else, a gentle nudge.
      const chat = smallTalk(text, forSelf(s));
      if (chat) {
        lines.push(chat);
        mood = "speaking";
      } else {
        lines.push(forSelf(s) ? "Hmm, I'm not sure I got that. Tell me what you're after, like a black hoodie in M, and I'll find it." : "Hmm, I'm not sure I got that. Tell me who it's for, or a budget, and I'll find something.");
        mood = "reassuring";
      }
    }
  }

  // What they told Pick
  const before = s;
  const fields: (keyof PickState)[] = [];
  for (const key of ["kind", "colour", "recipient", "occasion", "style", "budget", "sizing", "size"] as const) {
    if (set[key] === undefined) continue;
    const r = applySet(s, { [key]: set[key] } as NonNullable<Quick["set"]>);
    if (r.field) {
      s = r.state;
      fields.push(r.field);
    }
  }
  // A button gets a short acknowledgement; typed words get a summary of what Pick understood,
  // unless the AI already answered in its own words.
  // On the shop, a sentence that says enough (a budget, a fit, a size) but no kind: anything goes.
  if ("text" in input && forSelf(s) && !s.kind && fields.length >= 2) s = { ...s, kind: "any" };
  // A gift chosen from the shop: the gift questions from here on.
  if ("quick" in input && s.mode === "shop" && set.recipient && set.recipient !== "self") s = { ...s, gift: true };
  if ("quick" in input && fields.length === 1) lines.push(acknowledge(fields[0], s));
  else if ("text" in input && fields.length && !lines.length) lines.push(summary(s, fields));

  // What they asked for
  let input2: PickReply["input"];
  switch (action) {
    case "restart":
      if (s.mode === "shop") {
        const fresh: PickState = { mode: "shop" };
        return { messages: [{ text: `Fresh start. ${question("kind", fresh, prices).text}` }], state: fresh, quick: question("kind", fresh, prices).quick, mood: "greeting", ai: usedAi };
      }
      return { messages: [{ text: "Fresh start. Who are we shopping for?" }], state: {}, quick: question("recipient", {}, prices).quick, mood: "greeting", ai: usedAi };
    case "gift":
      // From the shop: the gift questions, starting with who it's for.
      s = { mode: s.mode, gift: true, budget: s.budget };
      lines.push("A gift! Love that.");
      mood = "happy";
      break;
    case "change-kind":
      s = { ...s, kind: undefined, colour: undefined, shown: [] };
      break;
    case "pair":
      break;
    case "any-colour":
      s = { ...s, colour: undefined, shown: [] };
      lines.push("Any colour, then.");
      break;
    case "help-decide":
      s = { ...s, recipientUnsure: true };
      lines.push("No pressure. Let's work it out together, one easy question at a time.");
      mood = "reassuring";
      break;
    case "more":
      break;
    case "cheaper": {
      const top = s.budget || maxShown(products, s) || 3000;
      const lower = Math.max(500, Math.floor((top * 0.7) / 100) * 100);
      s = { ...s, budget: lower, shown: [] };
      lines.push(`Let's bring it down. Under ${formatPrice(lower)} now.`);
      mood = "reassuring";
      break;
    }
    case "change-style":
      s = { ...s, style: undefined, shown: [] };
      break;
    case "change-budget":
    case "own-budget":
      s = { ...s, budget: undefined, shown: [] };
      lines.push("Type your budget in rupees, like 3000.");
      input2 = "budget";
      break;
    case "fit":
      lines.push(
        forSelf(s)
          ? "If it doesn't fit, swap the size within 14 days, in our store or by delivery."
          : "If it doesn't fit, they change the size from their gift link. Or they come to our store, try it on and swap it there.",
      );
      mood = "reassuring";
      break;
    case "delivery":
      lines.push(
        forSelf(s)
          ? `We deliver in the Kathmandu Valley for ${formatPrice(site.delivery.flatFee)}, free on orders over ${formatPrice(site.delivery.freeAbove)}. Or pick it up from the store.`
          : `We deliver in the Kathmandu Valley for ${formatPrice(site.delivery.flatFee)}, free on orders over ${formatPrice(site.delivery.freeAbove)}, or they collect it from the store. They get the gift link by email, and you can choose the day it arrives.`,
      );
      break;
    case "compare": {
      const last = (s.shown ?? []).slice(-3);
      const [a, b] = last.map((slug) => products.find((p) => p.slug === slug)).filter((p): p is Product => Boolean(p));
      lines.push(a && b ? compare(a, b) : "Let me show you a few pieces first, then I can compare them.");
      break;
    }
    case "skip":
      s = { ...s, occasion: s.occasion ?? "other" };
      break;
  }

  // Next: ask, or show
  const stage = stageOf(s);
  const changed = stageOf(before) !== stage || fields.length > 0;
  if (stage !== "results") {
    const q = question(stage, s, prices);
    if (input2) return { messages: [{ text: lines.join(" ") }], state: s, quick: [], input: input2, mood, ai: usedAi };
    lines.push(q.text);
    return { messages: [{ text: lines.join(" ") }], state: s, quick: q.quick, input: q.input, mood, ai: usedAi };
  }
  if (input2) return { messages: [{ text: lines.join(" ") }], state: s, quick: [], input: input2, mood, ai: usedAi };
  // A chat line that changes nothing (an aside, a thank-you) gets a reply, not the same pieces again.
  const aside = "text" in input && !fields.length && !action && Boolean(s.shown?.length);
  if (aside || action === "fit" || action === "delivery" || (action === "compare" && !changed)) {
    return { messages: [{ text: lines.join(" ") }], state: s, quick: question("results", s, prices).quick, mood, ai: usedAi };
  }

  if (action === "pair") {
    const cats = categoriesOf(s.kind);
    const kind = cats?.[0];
    const kinds = cats ? [...new Set(cats.flatMap((c) => GOES_WITH[c]))].filter((c) => !cats.includes(c)) : undefined;
    // Their colour was for the first piece, not for what goes with it.
    const { cards } = recommend(products, { ...s, colour: undefined, budget: undefined }, 3, kinds);
    if (cards.length) {
      s = { ...s, shown: [...(s.shown ?? []), ...cards.map((c) => c.slug)] };
      return {
        messages: [{ text: [...lines, `To wear with ${kind ? KIND_WORDS[s.kind!].toLowerCase() : "it"}:`].join(" ") }, { text: "", cards }],
        state: s,
        quick: question("results", s, prices).quick,
        mood: "happy",
        ai: usedAi,
      };
    }
  }

  const { cards } = recommend(products, s);
  if (!cards.length) {
    const none = s.shown?.length ? "That's everything that matches. Want to widen it a little?" : "Nothing matches all of that right now. Let's loosen one thing.";
    return {
      messages: [{ text: [...lines, none].join(" ") }],
      state: s,
      quick: forSelf(s)
        ? [
            ...(s.colour ? [{ label: "Any colour", action: "any-colour" as const }] : []),
            ...(s.budget ? [{ label: "Raise the budget", action: "change-budget" as const }] : []),
            { label: "Another fit", action: "change-style" },
            ...(s.sizing === "known" ? [{ label: "Show all sizes", set: { sizing: "unknown" } }] : []),
            { label: "Something else", action: "change-kind" },
          ]
        : [
            { label: "Raise the budget", action: "change-budget" },
            { label: "Try another style", action: "change-style" },
            ...(s.sizing === "known" ? [{ label: "Let them pick the size", set: { sizing: "unknown" } }] : []),
            { label: "Start again", action: "restart" },
          ],
      mood: "reassuring",
      ai: usedAi,
    };
  }
  s = { ...s, shown: [...(s.shown ?? []), ...cards.map((c) => c.slug)] };
  // Style ranks pieces rather than filtering them, so no "from N that fit" count here.
  const intro = action === "more" ? "A few more:" : forSelf(s) && s.kind && s.kind !== "any" ? `${KIND_WORDS[s.kind]} I'd pick for you:` : "Here's what I'd pick:";
  return {
    messages: [{ text: [...lines, intro].join(" ") }, { text: "", cards }],
    state: s,
    quick: question("results", s, prices).quick,
    mood: "happy",
    ai: usedAi,
  };
}

/** The dearest piece shown so far, so "cheaper" means cheaper than that. */
function maxShown(products: Product[], s: PickState): number {
  const prices = (s.shown ?? []).map((slug) => products.find((p) => p.slug === slug)).filter((p): p is Product => Boolean(p)).map((p) => p.salePrice ?? p.price);
  return prices.length ? Math.max(...prices) : 0;
}

/** "Got it: a birthday, someone special, under Rs 3,000." */
function summary(s: PickState, fields: (keyof PickState)[]): string {
  const bits = fields.map((f) => {
    if (f === "budget") return s.budget ? `under ${formatPrice(s.budget)}` : "no budget limit";
    if (f === "sizing") return s.sizing === "unknown" ? (forSelf(s) ? "any size" : "size unknown, so they'll pick it") : "you know the size";
    if (f === "colour") return s.colour ?? "";
    if (f === "size") return `size ${s.size}`;
    const v = s[f];
    return typeof v === "string" ? (WORDS[v] ?? v) : "";
  });
  return `Got it: ${bits.filter(Boolean).join(", ")}.`;
}
