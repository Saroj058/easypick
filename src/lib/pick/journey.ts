// Pick, the robot: the shape of a shopping chat, shared by the browser and the server.
// Pure (no database, no network), so it is unit-tested in test/pick.test.ts.
//
// Two journeys, one at a time. On the gift page: who it's for, the occasion, their style, a budget,
// and whether the size is known. On the shop (mode "shop", for themselves): what they're after,
// their size, how they like it to fit, and a budget; choosing "a gift for someone" there switches
// to the gift questions. Anything already answered (by a button or in their own words) is
// skipped. Products are never chosen here: the server picks them from the real catalogue
// (lib/pick/recommend.ts) and the AI only reads what the customer typed (lib/pick/ai.ts).

import { formatPrice } from "../format";
import type { Category, Size } from "../types";

export const GREETING = "Hey, I'm Pick! 👋 I help people send gifts they'll actually wear.";

export const RECIPIENTS = ["partner", "friend", "family", "self", "someone"] as const;
export const OCCASIONS = ["birthday", "anniversary", "valentine", "festival", "thanks", "just-because", "other"] as const;
export const STYLES = ["street", "minimal", "casual", "premium", "bold", "unsure"] as const;
export const SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];
/** What they're after on the shop: a kind of piece, or "any" (show me anything). */
export const KINDS = ["tees", "hoodies", "jackets", "bottoms", "co-ords", "accessories", "any"] as const;
/** Colour words Pick understands; matched against the catalogue's own colour names. */
export const COLOURS = ["black", "white", "grey", "navy", "blue", "green", "olive", "brown", "beige", "cream", "red", "maroon", "pink", "purple", "yellow", "orange"] as const;

export type Recipient = (typeof RECIPIENTS)[number];
export type Occasion = (typeof OCCASIONS)[number];
export type Style = (typeof STYLES)[number];
export type Kind = (typeof KINDS)[number];
export type Colour = (typeof COLOURS)[number];

/** What Pick knows so far. Only the shopping preferences: no names, numbers or addresses. */
export interface PickState {
  /** "shop": Pick on the shop page, helping them shop for themselves first. */
  mode?: "shop";
  /** On the shop: they chose "a gift for someone", so the gift questions apply. */
  gift?: boolean;
  /** On the shop: the kind of piece they're after. */
  kind?: Kind;
  /** A colour they asked for. */
  colour?: Colour;
  recipient?: Recipient;
  /** "unsure": they asked for help deciding; treated as answered. */
  recipientUnsure?: boolean;
  occasion?: Occasion;
  style?: Style;
  /** Their top price in rupees; 0 = no limit. */
  budget?: number;
  /** "known" with a size, or "unknown": they pick it from the gift link. */
  sizing?: "known" | "unknown";
  size?: Size;
  /** Products already shown, so "show more" brings new ones. */
  shown?: string[];
  /** The piece they chose to send. */
  picked?: string;
}

/** A quick reply: what the button says, and what it sets. */
export interface Quick {
  label: string;
  /** A field and value, or an action. */
  set?: Partial<Record<"recipient" | "occasion" | "style" | "sizing" | "size" | "kind" | "colour", string>> & { budget?: number };
  action?: PickAction;
}

export type PickAction = "help-decide" | "more" | "cheaper" | "restart" | "change-budget" | "change-style" | "own-budget" | "fit" | "delivery" | "compare" | "skip" | "pair" | "change-kind" | "gift" | "any-colour";

export type Stage = "kind" | "recipient" | "occasion" | "style" | "budget" | "sizing" | "size" | "results";

/** On the shop and shopping for themselves (not a gift). */
export const forSelf = (s: PickState) => s.mode === "shop" && !s.gift && (!s.recipient || s.recipient === "self");

/** The next thing to ask, given what is known. */
export function stageOf(s: PickState): Stage {
  if (forSelf(s)) {
    if (!s.kind) return "kind";
    // Accessories are one size: nothing to ask.
    if (!s.sizing && s.kind !== "accessories") return "size";
    if (!s.style) return "style";
    if (s.budget === undefined) return "budget";
    return "results";
  }
  if (!s.recipient && !s.recipientUnsure) return "recipient";
  if (!s.occasion && s.recipient !== "self") return "occasion";
  if (!s.style) return "style";
  if (s.budget === undefined) return "budget";
  if (!s.sizing) return "sizing";
  if (s.sizing === "known" && !s.size) return "size";
  return "results";
}

/** Who-for words, to make the questions read naturally. */
export function them(s: PickState): string {
  switch (s.recipient) {
    case "partner":
      return "your person";
    case "friend":
      return "your friend";
    case "family":
      return "them";
    case "self":
      return "you";
    default:
      return "them";
  }
}

/** Budget buttons from the store's real prices: roughly the quarters of what is on sale, rounded. */
export function budgetSteps(prices: number[]): number[] {
  const live = prices.filter((p) => p > 0).sort((a, b) => a - b);
  if (!live.length) return [];
  const at = (f: number) => live[Math.min(live.length - 1, Math.floor(f * (live.length - 1)))];
  const round = (n: number) => Math.ceil(n / 500) * 500;
  return Array.from(new Set([at(0.25), at(0.5), at(0.75), at(0.9)].map(round))).filter((b) => b > live[0]);
}

/** The question for a stage, and its quick replies. `prices`: every live price, for the budget buttons. */
export function question(stage: Stage, s: PickState, prices: number[]): { text: string; quick: Quick[]; input?: "budget" } {
  const self = s.recipient === "self" || forSelf(s);
  const shop = forSelf(s);
  switch (stage) {
    case "kind":
      return {
        text: "What are you after today?",
        quick: [
          { label: "Tees", set: { kind: "tees" } },
          { label: "Hoodies", set: { kind: "hoodies" } },
          { label: "Jackets", set: { kind: "jackets" } },
          { label: "Bottoms", set: { kind: "bottoms" } },
          { label: "Co-ords", set: { kind: "co-ords" } },
          { label: "Accessories", set: { kind: "accessories" } },
          { label: "Show me anything", set: { kind: "any" } },
          { label: "A gift for someone 🎁", action: "gift" },
        ],
      };
    case "recipient":
      return {
        text: "Who are we shopping for today?",
        quick: [
          { label: "Someone special ❤️", set: { recipient: "partner" } },
          { label: "A friend", set: { recipient: "friend" } },
          { label: "Family", set: { recipient: "family" } },
          { label: "Myself", set: { recipient: "self" } },
          { label: "Help me decide", action: "help-decide" },
        ],
      };
    case "occasion":
      return {
        text: "What's the occasion?",
        quick: [
          { label: "Birthday", set: { occasion: "birthday" } },
          { label: "Anniversary", set: { occasion: "anniversary" } },
          { label: "Dashain or Tihar", set: { occasion: "festival" } },
          { label: "Saying thank you", set: { occasion: "thanks" } },
          { label: "Just because", set: { occasion: "just-because" } },
        ],
      };
    case "style":
      if (shop)
        return {
          text: "How do you like it to fit?",
          quick: [
            { label: "Oversized", set: { style: "street" } },
            { label: "Relaxed", set: { style: "casual" } },
            { label: "Regular, clean", set: { style: "minimal" } },
            { label: "Something bold", set: { style: "bold" } },
            { label: "Any fit", set: { style: "unsure" } },
          ],
        };
      return {
        text: self ? "What do you usually love wearing?" : `What kind of clothes does ${them(s)} usually wear?`,
        quick: [
          { label: "Streetwear, oversized", set: { style: "street" } },
          { label: "Minimal and clean", set: { style: "minimal" } },
          { label: "Everyday casual", set: { style: "casual" } },
          { label: "Premium brands", set: { style: "premium" } },
          { label: "Something bold", set: { style: "bold" } },
          { label: "Not sure", set: { style: "unsure" } },
        ],
      };
    case "budget":
      return {
        text: "What's a comfortable budget? Prices include VAT.",
        quick: [
          ...budgetSteps(prices).map((b) => ({ label: `Under ${formatPrice(b)}`, set: { budget: b } })),
          { label: "No limit", set: { budget: 0 } },
          { label: "Type my own", action: "own-budget" as const },
        ],
        input: "budget",
      };
    case "sizing":
      return {
        text: self ? "Do you know your size in our pieces?" : `Do you know ${them(s) === "them" ? "their" : `${them(s)}'s`} size?`,
        quick: [
          { label: self ? "Yes, I know it" : "I know their size", set: { sizing: "known" } },
          { label: self ? "Not sure" : "I don't know it", set: { sizing: "unknown" } },
          { label: "What if it doesn't fit?", action: "fit" },
        ],
      };
    case "size":
      return {
        text: self ? "Which size do you wear?" : "Which size do they wear?",
        quick: [...SIZES.map((z) => ({ label: z, set: { size: z } })), { label: shop ? "Not sure, show all sizes" : "Actually, not sure", set: { sizing: "unknown" } }],
      };
    case "results":
      if (shop)
        return {
          text: "",
          quick: [
            { label: "Show me more", action: "more" },
            ...(s.kind && s.kind !== "any" && s.kind !== "accessories" ? [{ label: "What goes with it?", action: "pair" as const }] : []),
            { label: "Something cheaper", action: "cheaper" },
            { label: "Something else", action: "change-kind" },
          ],
        };
      return {
        text: "",
        quick: [
          // Three, to keep his bubble small; comparing and starting again work by typing (or the ↺ icon).
          { label: "Show me more", action: "more" },
          { label: "Something cheaper", action: "cheaper" },
          { label: "Another style", action: "change-style" },
        ],
      };
  }
}

/** A short, warm line acknowledging an answer, before the next question. Never states facts. */
export function acknowledge(field: keyof PickState, s: PickState): string {
  if (field === "kind") {
    if (s.kind === "any") return "Anything goes. I like it.";
    if (s.kind === "accessories") return "Accessories. The finishing touch.";
    return `${KIND_WORDS[s.kind ?? "any"]}. Good choice.`;
  }
  if (field === "style" && forSelf(s)) {
    if (s.style === "unsure") return "Any fit. I'll show the best of everything.";
    return "Noted.";
  }
  if (field === "sizing" && forSelf(s)) return s.sizing === "unknown" ? "No problem. I'll show every size, and you can swap it within 14 days." : "Great, that makes it easy.";
  if (field === "recipient") {
    if (s.recipient === "partner") return "Someone special. Let's find something they'll actually wear.";
    if (s.recipient === "friend") return "A friend. Love that.";
    if (s.recipient === "family") return "Family it is.";
    if (s.recipient === "self") return "Treating yourself. Good call.";
    return "Got it.";
  }
  if (field === "occasion") {
    if (s.occasion === "birthday") return "A birthday. Let's make it a good one.";
    if (s.occasion === "anniversary") return "An anniversary. Something a little special, then.";
    if (s.occasion === "festival") return "Festival season. Something new to wear is tradition.";
    if (s.occasion === "thanks") return "A thank-you gift. Thoughtful.";
    return "No reason needed. The best kind of gift.";
  }
  if (field === "style") {
    if (s.style === "unsure") return "No problem. I'll stick to pieces that suit most people.";
    return "Noted.";
  }
  if (field === "budget") return s.budget ? `Under ${formatPrice(s.budget)}. I'll keep it there.` : "No limit. I'll show the best matches.";
  if (field === "sizing") return s.sizing === "unknown" ? "No guessing, then. They pick their own size from the gift link." : "Great, that makes it easy.";
  if (field === "size") return `Size ${s.size}. I'll only show pieces with ${s.size} in stock.`;
  return "Got it.";
}

/** How a kind reads at the start of a sentence. */
export const KIND_WORDS: Record<Kind, string> = { tees: "Tees", hoodies: "Hoodies", jackets: "Jackets", bottoms: "Bottoms", "co-ords": "Co-ords", accessories: "Accessories", any: "Anything" };

/** The catalogue category for a kind ("any" is none). */
export const categoryOf = (k?: Kind): Category | undefined => (k && k !== "any" ? k : undefined);

/** Applies a quick reply's values to the state, checking every value against the allowed lists. */
export function applySet(s: PickState, set: NonNullable<Quick["set"]>): { state: PickState; field?: keyof PickState } {
  const next: PickState = { ...s };
  let field: keyof PickState | undefined;
  if (set.kind && (KINDS as readonly string[]).includes(set.kind)) {
    next.kind = set.kind as Kind;
    field = "kind";
    next.shown = [];
  }
  if (set.colour && (COLOURS as readonly string[]).includes(set.colour)) {
    next.colour = set.colour as Colour;
    field = "colour";
    next.shown = [];
  }
  if (set.recipient && (RECIPIENTS as readonly string[]).includes(set.recipient)) {
    next.recipient = set.recipient as Recipient;
    field = "recipient";
  }
  if (set.occasion && (OCCASIONS as readonly string[]).includes(set.occasion)) {
    next.occasion = set.occasion as Occasion;
    field = "occasion";
  }
  if (set.style && (STYLES as readonly string[]).includes(set.style)) {
    next.style = set.style as Style;
    field = "style";
    next.shown = [];
  }
  if (typeof set.budget === "number" && Number.isFinite(set.budget) && set.budget >= 0 && set.budget <= 1_000_000) {
    next.budget = Math.round(set.budget);
    field = "budget";
    next.shown = [];
  }
  if (set.sizing === "known" || set.sizing === "unknown") {
    next.sizing = set.sizing;
    if (set.sizing === "unknown") delete next.size;
    field = "sizing";
    next.shown = [];
  }
  if (set.size && (SIZES as string[]).includes(set.size)) {
    next.size = set.size as Size;
    next.sizing = "known";
    field = "size";
    next.shown = [];
  }
  return { state: next, field };
}

/** Keeps only valid fields from a state sent by the browser (it is never trusted as-is). */
export function cleanState(raw: unknown): PickState {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const s: PickState = {};
  if (r.mode === "shop") s.mode = "shop";
  if (r.gift === true) s.gift = true;
  if (typeof r.kind === "string" && (KINDS as readonly string[]).includes(r.kind)) s.kind = r.kind as Kind;
  if (typeof r.colour === "string" && (COLOURS as readonly string[]).includes(r.colour)) s.colour = r.colour as Colour;
  if (typeof r.recipient === "string" && (RECIPIENTS as readonly string[]).includes(r.recipient)) s.recipient = r.recipient as Recipient;
  if (r.recipientUnsure === true) s.recipientUnsure = true;
  if (typeof r.occasion === "string" && (OCCASIONS as readonly string[]).includes(r.occasion)) s.occasion = r.occasion as Occasion;
  if (typeof r.style === "string" && (STYLES as readonly string[]).includes(r.style)) s.style = r.style as Style;
  if (typeof r.budget === "number" && Number.isFinite(r.budget) && r.budget >= 0 && r.budget <= 1_000_000) s.budget = Math.round(r.budget);
  if (r.sizing === "known" || r.sizing === "unknown") s.sizing = r.sizing;
  if (typeof r.size === "string" && (SIZES as string[]).includes(r.size)) s.size = r.size as Size;
  if (Array.isArray(r.shown)) s.shown = r.shown.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,80}$/.test(x)).slice(0, 60);
  if (typeof r.picked === "string" && /^[a-z0-9-]{1,80}$/.test(r.picked)) s.picked = r.picked;
  return s;
}

/**
 * A friendly answer to small talk (hi, how are you, who are you, thanks, a joke…), so Pick always
 * replies, even without the AI. Never states facts about products, prices or policies.
 */
export function smallTalk(text: string, shop = false): string | null {
  const gift = shop ? "something good to wear" : "a gift";
  const t = ` ${text.toLowerCase().replace(/[’']/g, "'").replace(/[!?.,]+/g, " ")} `;
  const has = (re: RegExp) => re.test(t);
  if (has(/\b(namaste|namaskar)\b/)) return "Namaste! 🙏 Lovely to meet you.";
  if (has(/\b(how are you|how r u|how's it going|how are things|what's up|wassup|sup)\b/)) return `I'm great, thanks for asking. Always happy when there's ${gift} to find. And you?`;
  if (has(/\b(who are you|what are you|your name|are you (a )?(bot|robot|real|human|ai))\b/)) return shop ? "I'm Pick, Easypick's little shopping robot. Small, but I know every piece in the store." : "I'm Pick, Easypick's little gift robot. A small one, with a big heart for gifts.";
  if (has(/\b(what can you do|how does this work|how do you work|help me|can you help)\b/)) return shop ? "Tell me what you're after, like a black hoodie in M under 3000, and I'll find it in stock." : "Tell me who it's for and roughly what you'd like to spend, and I'll find pieces they'll actually wear.";
  if (has(/\b(joke|make me laugh|something funny)\b/)) return "Why did the hoodie feel left out? Everyone kept zipping past it. 😄";
  if (has(/\b(love you|you're cute|you are cute|you're sweet|cute robot)\b/)) return "Aw. I'm only a robot, but I'm blushing. 💛";
  if (has(/\b(bye|goodbye|see you|see ya|good night|gn)\b/)) return `Bye for now! I'll be right here when you need ${shop ? "a hand" : "a gift idea"}.`;
  if (has(/\b(thanks|thank you|thank u|thx|ty|dhanyabad|dhanyabaad)\b/)) return "Anytime! 💛";
  if (has(/\b(good morning|good afternoon|good evening)\b/)) return "And a good one to you too!";
  if (has(/\b(hi|hello|hey|hii+|heyy+|hola|yo|oi)\b/)) return "Hey! Nice to see you.";
  if (has(/\b(lol|haha+|hehe+|lmao)\b/)) return "Ha! 😄";
  if (has(/\b(ok|okay|cool|nice|great|awesome|sure|alright|fine)\b/)) return "Great.";
  if (has(/\b(weather|rain|hot|cold)\b/)) return shop ? "I don't get out much, but a good hoodie covers most weather." : "I don't get out much, but it's always good weather for a gift.";
  if (has(/\b(bored|sad|tired|stressed)\b/)) return shop ? "Sending you a little robot hug. 🤖 Something new to wear might help too." : "Sending you a little robot hug. 🤖 Maybe a gift for someone will cheer us both up.";
  return null;
}

/**
 * Reads a typed message without any AI: budgets ("under 3000", "Rs 2,500", "3k"), who it's for,
 * the occasion, style words, sizes, and plain requests ("cheaper", "start again"). The AI, when
 * it is available, adds to this; when it isn't, this alone keeps Pick useful.
 */
export function readMessage(text: string): { set: NonNullable<Quick["set"]>; action?: PickAction } {
  const t = ` ${text.toLowerCase().replace(/[’']/g, "'")} `;
  const set: NonNullable<Quick["set"]> = {};
  let action: PickAction | undefined;
  const has = (re: RegExp) => re.test(t);

  if (has(/\b(start (again|over)|restart|reset)\b/)) action = "restart";
  else if (has(/\b(cheaper|less expensive|too expensive|more affordable|lower price)\b/)) action = "cheaper";
  else if (has(/\b(compare|difference between|which is better)\b/)) action = "compare";
  else if (has(/\b(more options|show (me )?more|anything else|other options)\b/)) action = "more";
  else if (has(/\b(doesn't fit|does not fit|wrong size|exchange|swap|return)\b/)) action = "fit";
  else if (has(/\b(deliver|delivery|send (it )?(directly|straight)|shipping|how long)\b/)) action = "delivery";

  // Budget: "under 3000", "below rs 2,500", "3k", "npr 4000", "around 2000".
  const k = t.match(/(\d+(?:\.\d+)?)\s*k\b/);
  const n = t.match(/(?:rs\.?|npr|under|below|max|around|about|upto|up to|within|budget(?: is| of)?)\s*([\d,]{3,7})/) ?? t.match(/\b([\d,]{4,7})\s*(?:rs|rupees|npr)?\b/);
  if (k) set.budget = Math.round(parseFloat(k[1]) * 1000);
  else if (n) set.budget = parseInt(n[1].replace(/,/g, ""), 10);
  if (has(/\b(no (budget|limit)|any price|money is no object)\b/)) set.budget = 0;

  if (has(/\b(boyfriend|girlfriend|bf|gf|partner|husband|wife|fianc[eé]e?|crush|my love|special someone)\b/)) set.recipient = "partner";
  else if (has(/\b(friend|bestie|best friend|buddy|colleague|coworker|boss)\b/)) set.recipient = "friend";
  else if (has(/\b(brother|sister|dad|father|mom|mum|mother|son|daughter|cousin|uncle|aunt|family|dai|didi|bhai|bahini|grandpa|grandma)\b/)) set.recipient = "family";
  else if (has(/\b(for me|myself|treat myself|my own)\b/)) set.recipient = "self";

  if (has(/\b(tee|tees|t-?shirts?|tshirts?|shirts?)\b/)) set.kind = "tees";
  else if (has(/\b(hoodies?|hoody|sweatshirts?|sweaters?|pullovers?)\b/)) set.kind = "hoodies";
  else if (has(/\b(jackets?|coats?|bombers?|windbreakers?|outerwear)\b/)) set.kind = "jackets";
  else if (has(/\b(pants|trousers|jeans|cargos?|joggers?|shorts|bottoms?|track ?pants|sweatpants)\b/)) set.kind = "bottoms";
  else if (has(/\b(co-?ords?|matching set|tracksuits?|twin ?set)\b/)) set.kind = "co-ords";
  else if (has(/\b(caps?|hats?|beanies?|bags?|socks|accessor(y|ies)|totes?)\b/)) set.kind = "accessories";

  const colour = COLOURS.find((c) => has(new RegExp(`\\b${c === "grey" ? "gr[ae]y" : c}\\b`)));
  if (colour) set.colour = colour;

  if (has(/\b(birthday|bday|b-day)\b/)) set.occasion = "birthday";
  else if (has(/\b(anniversary)\b/)) set.occasion = "anniversary";
  else if (has(/\b(valentine)/)) set.occasion = "valentine";
  else if (has(/\b(dashain|tihar|bhai ?tika|festival|new year|christmas|eid|holi|teej)\b/)) set.occasion = "festival";
  else if (has(/\b(thank[- ]?you (gift|present)|thanks (gift|present)|to say thank|as a thank)/)) set.occasion = "thanks";
  else if (has(/\b(just because|no reason|no occasion)\b/)) set.occasion = "just-because";

  if (has(/\b(oversized|baggy|street ?wear|streetstyle|hype|loose)\b/)) set.style = "street";
  else if (has(/\b(minimal|clean|simple|basic|basics|plain|neutral)\b/)) set.style = "minimal";
  else if (has(/\b(casual|everyday|comfy|comfortable|relaxed)\b/)) set.style = "casual";
  else if (has(/\b(premium|luxury|brand|branded|nike|adidas|puma|new balance|converse|carhartt|special)\b/)) set.style = "premium";
  else if (has(/\b(bold|colou?rful|bright|loud|statement)\b/)) set.style = "bold";

  if (has(/\b(don't know (his|her|their) size|dont know (his|her|their) size|not sure (of|about) (his|her|their) size|no idea (of|about)? ?(his|her|their)? ?size|unknown size)\b/)) set.sizing = "unknown";
  const sz = t.match(/\b(?:size|wears?(?: a| an)?|is an?|in(?: an?)?)\s+(xxl|xl|xs|s|m|l)\b/) ?? t.match(/\b(xxl|xl|xs)\b/);
  if (sz) set.size = sz[1].toUpperCase();

  return { set, action };
}
