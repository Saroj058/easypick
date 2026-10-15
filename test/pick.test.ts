import { describe, expect, it } from "vitest";

import { validate } from "@/lib/pick/ai";
import { applySet, budgetSteps, cleanState, readMessage, stageOf } from "@/lib/pick/journey";
import { recommend } from "@/lib/pick/recommend";
import { turn } from "@/lib/pick/turn";
import type { Product, Size } from "@/lib/types";

// Pick, the gift page's robot: the journey, the reading of typed messages, the checks on the AI's
// answer, and recommendations from the catalogue (never invented).

function piece(slug: string, o: { price: number; fit?: Product["fit"]; category?: Product["category"]; colour?: string; sizes?: Size[]; stock?: number; tags?: string[]; vault?: boolean; salePrice?: number }): Product {
  const colour = o.colour ?? "Black";
  const sizes = o.sizes ?? ["S", "M", "L"];
  return {
    id: slug,
    slug,
    name: slug.replace(/-/g, " "),
    category: o.category ?? "tees",
    gender: "unisex",
    fit: o.fit ?? "regular",
    dropSlug: null,
    shortDescription: "",
    details: [],
    tags: o.tags ?? [],
    colours: [{ name: colour, hex: "#111111" }],
    images: [],
    price: o.price,
    salePrice: o.salePrice,
    measurements: {},
    variants: sizes.map((z) => ({ sku: `${slug}-${z}`, size: z, colour, stock: o.stock ?? 5 })),
    status: "live",
    showOn: { website: true, kiosk: true },
    vault: o.vault,
  } as Product;
}

const CATALOGUE = [
  piece("box-hoodie", { price: 2999, fit: "oversized", category: "hoodies", colour: "Charcoal" }),
  piece("plain-tee", { price: 999, fit: "regular", colour: "Ivory" }),
  piece("relaxed-cargo", { price: 2499, fit: "relaxed", category: "bottoms", colour: "Olive" }),
  piece("brick-overshirt", { price: 3299, fit: "regular", category: "jackets", colour: "Brick" }),
  piece("logo-cap", { price: 799, category: "accessories", sizes: ["ONE"] }),
  piece("vault-runner", { price: 15999, category: "accessories", sizes: ["ONE"], vault: true, tags: ["vault", "nike"] }),
  piece("sold-out-tee", { price: 1299, stock: 0 }),
  piece("xl-only-tee", { price: 1499, sizes: ["XL"] }),
];

describe("reading a typed message", () => {
  it("pulls several answers from one sentence", () => {
    const r = readMessage("I need a birthday gift for my boyfriend under NPR 3,000. He likes oversized clothes, but I don't know his size.");
    expect(r.set).toMatchObject({ recipient: "partner", occasion: "birthday", budget: 3000, style: "street", sizing: "unknown" });
  });
  it("understands 3k, no limit, sizes and requests", () => {
    expect(readMessage("around 3k please").set.budget).toBe(3000);
    expect(readMessage("no budget, money is no object").set.budget).toBe(0);
    expect(readMessage("he wears size L").set.size).toBe("L");
    expect(readMessage("something cheaper").action).toBe("cheaper");
    expect(readMessage("let's start again").action).toBe("restart");
    expect(readMessage("what happens if it doesn't fit?").action).toBe("fit");
    expect(readMessage("can you send it directly to them?").action).toBe("delivery");
  });
});

describe("what Pick knows", () => {
  it("asks one thing at a time and skips what's known", () => {
    expect(stageOf({})).toBe("recipient");
    expect(stageOf({ recipient: "self" })).toBe("style"); // no occasion needed for yourself
    expect(stageOf({ recipient: "friend", occasion: "birthday", style: "casual", budget: 0, sizing: "known" })).toBe("size");
    expect(stageOf({ recipient: "friend", occasion: "birthday", style: "casual", budget: 0, sizing: "unknown" })).toBe("results");
  });
  it("rejects values that aren't on the lists", () => {
    expect(applySet({}, { recipient: "hacker", size: "XXXL", budget: -5 }).state).toEqual({});
    expect(cleanState({ recipient: "partner", budget: 1e12, shown: ["ok-slug", "<script>"], picked: "../x" })).toEqual({ recipient: "partner", shown: ["ok-slug"] });
  });
  it("offers budgets from the store's own prices", () => {
    const steps = budgetSteps([299, 999, 1499, 2299, 2999, 3499, 4999, 19999]);
    expect(steps.length).toBeGreaterThan(1);
    expect(steps.every((b) => b % 500 === 0)).toBe(true);
  });
});

describe("the AI's answer is checked, never trusted", () => {
  it("keeps valid fields and drops the rest", () => {
    const u = validate({ recipient: "partner", style: "premium", budget: 3000, size: "M", intent: "answer", reply: "Love that." });
    expect(u).toEqual({ set: { recipient: "partner", style: "premium", budget: 3000, size: "M" }, action: undefined, reply: "Love that." });
    const bad = validate({ recipient: "admin", budget: "free", size: "XXXL", intent: "delete-db", reply: "Only Rs 99 today!" });
    expect(bad).toEqual({ set: {}, action: undefined, reply: undefined });
    expect(validate("not json")).toBeNull();
  });
  it("never lets a reply carry a price or a link", () => {
    expect(validate({ intent: "answer", reply: "This one is 2,999." })?.reply).toBeUndefined();
    expect(validate({ intent: "answer", reply: "See www.example.com" })?.reply).toBeUndefined();
  });
});

describe("recommendations come from the catalogue", () => {
  it("stays inside the budget and never shows what can't be sold", () => {
    const { cards } = recommend(CATALOGUE, { budget: 2500, sizing: "unknown" }, 10);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.price <= 2500)).toBe(true);
    expect(cards.map((c) => c.slug)).not.toContain("sold-out-tee");
  });
  it("with a known size, shows only pieces with that size in stock (or one size)", () => {
    const { cards } = recommend(CATALOGUE, { sizing: "known", size: "XL" }, 10);
    expect(cards.map((c) => c.slug).sort()).toEqual(["logo-cap", "vault-runner", "xl-only-tee"].sort());
  });
  it("matches the style and says why, from the product's own facts", () => {
    const { cards } = recommend(CATALOGUE, { style: "street", budget: 5000 }, 1);
    expect(cards[0].slug).toBe("box-hoodie");
    expect(cards[0].why).toMatch(/Oversized/);
  });
  it("brings new pieces for 'show more'", () => {
    const first = recommend(CATALOGUE, { budget: 0 }, 2).cards.map((c) => c.slug);
    const next = recommend(CATALOGUE, { budget: 0, shown: first }, 2).cards.map((c) => c.slug);
    expect(next.some((s) => first.includes(s))).toBe(false);
  });
});

describe("a whole chat", () => {
  it("greets, then guides with buttons only to real products", async () => {
    let r = await turn(CATALOGUE, {}, { start: true });
    expect(r.messages[0].text).toMatch(/I'm Pick/);
    expect(r.quick.map((q) => q.label)).toContain("Someone special ❤️");
    const press = async (label: string) => {
      const q = r.quick.find((x) => x.label === label || x.label.startsWith(label));
      if (!q) throw new Error(`no button ${label}: ${r.quick.map((x) => x.label).join(" | ")}`);
      r = await turn(CATALOGUE, r.state, { quick: q });
    };
    await press("A friend");
    await press("Birthday");
    await press("Streetwear");
    await press("No limit");
    await press("I don't know it");
    const cards = r.messages.flatMap((m) => m.cards ?? []);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => CATALOGUE.some((p) => p.slug === c.slug && (p.salePrice ?? p.price) === c.price))).toBe(true);
    await press("Something cheaper");
    expect(r.state.budget).toBeGreaterThan(0);
    expect(r.messages.flatMap((m) => m.cards ?? []).every((c) => c.price <= r.state.budget!)).toBe(true);
  });

  it("one typed sentence skips the questions it answers", async () => {
    const r = await turn(CATALOGUE, {}, { text: "birthday gift for my girlfriend under 3000, she likes oversized, don't know her size" });
    expect(r.state).toMatchObject({ recipient: "partner", occasion: "birthday", budget: 3000, style: "street", sizing: "unknown" });
    expect(r.messages.some((m) => m.cards?.length)).toBe(true);
  });

  it("keeps working when the AI is down or slow", async () => {
    const r = await turn(CATALOGUE, { recipient: "friend" }, { text: "for her birthday" }, async () => null);
    expect(r.state.occasion).toBe("birthday");
    expect(r.ai).toBe(false);
  });

  it("an AI reply can't overrule the catalogue", async () => {
    const r = await turn(CATALOGUE, {}, { text: "anything" }, async () => ({ set: { budget: 900, style: "minimal", recipient: "self", sizing: "unknown" }, reply: "Ooh, nice." }));
    const cards = r.messages.flatMap((m) => m.cards ?? []);
    expect(cards.every((c) => c.price <= 900)).toBe(true);
    expect(r.messages[0].text).toMatch(/^Ooh, nice\./);
  });

  it("says so when nothing matches, and offers a way out", async () => {
    const r = await turn(CATALOGUE, { recipient: "self", style: "premium", budget: 300, sizing: "unknown" }, { quick: { label: "Show me more", action: "more" } });
    expect(r.messages[0].text).toMatch(/Nothing matches/);
    expect(r.quick.map((q) => q.label)).toContain("Raise the budget");
    expect(r.mood).toBe("reassuring");
  });
});

describe("small talk", () => {
  it("answers hi, how are you and thanks, then carries on", async () => {
    let r = await turn(CATALOGUE, {}, { text: "hi" });
    expect(r.messages[0].text).toMatch(/^Hey! Nice to see you\. Who are we shopping for today\?$/);
    r = await turn(CATALOGUE, {}, { text: "how are you?" });
    expect(r.messages[0].text).toMatch(/I'm great/);
    r = await turn(CATALOGUE, { recipient: "friend" }, { text: "thanks!" });
    expect(r.messages[0].text).toMatch(/^Anytime/);
    expect(r.state.occasion).toBeUndefined(); // "thanks" alone isn't the occasion
    expect(readMessage("a thank you gift for my teacher").set.occasion).toBe("thanks");
  });
});

describe("asides", () => {
  it("an off-topic line gets a reply, not the same pieces again", async () => {
    const state = { recipient: "friend" as const, occasion: "birthday" as const, style: "casual" as const, budget: 0, sizing: "unknown" as const, shown: ["plain-tee"] };
    const r = await turn(CATALOGUE, state, { text: "what's the weather like?" }, async () => ({ set: {}, reply: "Sunny enough for a gift hunt." }));
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].text).toBe("Sunny enough for a gift hunt.");
    expect(r.quick.map((q) => q.label)).toContain("Show me more");
  });
});

describe("on the shop, for themselves", () => {
  const SHOP = { mode: "shop" as const };
  const pressOn = async (r: Awaited<ReturnType<typeof turn>>, label: string) => {
    const q = r.quick.find((x) => x.label === label || x.label.startsWith(label));
    if (!q) throw new Error(`no button ${label}: ${r.quick.map((x) => x.label).join(" | ")}`);
    return turn(CATALOGUE, r.state, { quick: q });
  };

  it("asks what they're after, their size, the fit and a budget; never who it's for", async () => {
    expect(stageOf(SHOP)).toBe("kind");
    let r = await turn(CATALOGUE, SHOP, { quick: { label: "Hoodies", set: { kind: "hoodies" } } });
    expect(r.messages[0].text).toMatch(/Hoodies\. .*Which size do you wear\?/);
    r = await pressOn(r, "M");
    expect(r.messages[0].text).toMatch(/How do you like it to fit\?/);
    r = await pressOn(r, "Oversized");
    r = await pressOn(r, "No limit");
    const cards = r.messages.flatMap((m) => m.cards ?? []);
    expect(cards.map((c) => c.slug)).toEqual(["box-hoodie"]);
    expect(cards[0].options.find((o) => o.size === "M")?.sku).toBe("box-hoodie-M");
    expect(r.quick.map((q) => q.label)).toContain("What goes with it?");
    // What goes with a hoodie: bottoms and accessories, not more hoodies.
    r = await pressOn(r, "What goes with it?");
    const pairs = r.messages.flatMap((m) => m.cards ?? []);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every((c) => c.category === "bottoms" || c.category === "accessories")).toBe(true);
  });

  it("reads a kind, a colour and a size from one sentence; a saved size skips the question", async () => {
    expect(readMessage("a black hoodie in size M").set).toMatchObject({ kind: "hoodies", colour: "black", size: "M" });
    expect(readMessage("olive cargos").set).toMatchObject({ kind: "bottoms", colour: "olive" });
    const r = await turn(CATALOGUE, { ...SHOP, sizing: "known", size: "M", style: "unsure", budget: 0 }, { text: "olive cargos" });
    expect(r.messages.flatMap((m) => m.cards ?? []).map((c) => c.slug)).toEqual(["relaxed-cargo"]);
  });

  it("a sentence with no kind but enough to go on shows anything; a colour with nothing to show offers 'any colour'", async () => {
    const r = await turn(CATALOGUE, SHOP, { text: "something for me under 2000, oversized, size M" });
    expect(r.state.kind).toBe("any");
    const none = await turn(CATALOGUE, { ...SHOP, kind: "tees", sizing: "unknown", style: "unsure", budget: 0 }, { text: "a pink tee" });
    expect(none.quick.map((q) => q.label)).toContain("Any colour");
    const any = await pressOn(none, "Any colour");
    expect(any.state.colour).toBeUndefined();
    expect(any.messages.flatMap((m) => m.cards ?? []).length).toBeGreaterThan(0);
  });

  it("'a gift for someone' switches to the gift questions; start again stays on the shop", async () => {
    let r = await turn(CATALOGUE, SHOP, { quick: { label: "A gift for someone 🎁", action: "gift" } });
    expect(r.state.gift).toBe(true);
    expect(r.messages[0].text).toMatch(/Who are we shopping for/);
    r = await turn(CATALOGUE, r.state, { quick: { label: "Start again", action: "restart" } });
    expect(r.state).toEqual({ mode: "shop" });
    expect(r.messages[0].text).toMatch(/What are you after today\?/);
    // Typing that it's for someone else also turns it into a gift.
    const g = await turn(CATALOGUE, SHOP, { text: "a birthday gift for my brother" });
    expect(g.state).toMatchObject({ gift: true, recipient: "family", occasion: "birthday" });
  });

  it("only keeps known kinds and colours from the browser", () => {
    expect(cleanState({ mode: "shop", kind: "hats", colour: "rainbow", gift: "yes" })).toEqual({ mode: "shop" });
    expect(applySet({}, { kind: "co-ords", colour: "navy" }).state).toMatchObject({ kind: "co-ords", colour: "navy" });
  });
});
