import "server-only";

import type { Category, Fit, Gender } from "@/lib/types";

// "Fill in from the photo" on Add a piece (owner, 19 Oct 2026): the model looks at the front photo
// and suggests a name, kind, fit, who it's for, a one-line description, a few detail lines, the
// colour and some search words. Only suggestions: the owner sees every field before saving, and
// everything is checked against fixed lists here. It never sets prices or stock.
//
// Same provider and key as Pick (lib/pick/ai.ts): Gemini's lite models on the free tier. PICK_AI=off
// (tests) or no GEMINI_API_KEY turns it off; the page then says so and the owner types as before.

export interface Described {
  name?: string;
  category?: Category;
  fit?: Fit;
  gender?: Gender;
  shortDescription?: string;
  details?: string[];
  colour?: string;
  tags?: string[];
}

const FITS: Fit[] = ["oversized", "relaxed", "regular"];
const GENDERS: Gender[] = ["unisex", "men", "women"];
const TIMEOUT_MS = 12_000;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    category: { type: "STRING" },
    fit: { type: "STRING", enum: FITS },
    gender: { type: "STRING", enum: GENDERS },
    shortDescription: { type: "STRING" },
    details: { type: "ARRAY", items: { type: "STRING" } },
    colour: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
  },
};

export const describeAvailable = () => process.env.PICK_AI !== "off" && Boolean(process.env.GEMINI_API_KEY?.trim());

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export async function describePhoto(image: { base64: string; mime: string }, kinds: { id: Category; label: string }[]): Promise<Described | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || process.env.PICK_AI === "off") return null;
  const system = `You write product listings for Easypick, a men's streetwear store in Kathmandu. Look at the photo of one garment and describe only what you can see.
- name: 2 to 4 words, plain and specific, like "Boxy Pocket Tee" or "Washed Cargo Pant". No brand names, no hype words.
- category: one of ${kinds.map((k) => `${k.id} (${k.label})`).join(", ")}.
- fit: oversized, relaxed or regular, from the cut you can see.
- gender: unisex unless it is clearly cut for men or women.
- shortDescription: one calm sentence, at most 90 characters, no prices, no claims you can't see.
- details: 2 to 4 short lines a shopper would want (cut, collar, pockets, closure, visible fabric look). Never guess fabric weight or composition.
- colour: the everyday colour name, one or two words.
- tags: 3 to 6 lowercase search words.`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: image.mime, data: image.base64 } }, { text: "Describe this piece." }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.4, maxOutputTokens: 400 },
  });
  const models = Array.from(new Set([process.env.PICK_AI_MODEL, "gemini-flash-lite-latest", "gemini-3.5-flash-lite"].filter((m): m is string => Boolean(m && /^[a-z0-9.-]{3,60}$/.test(m)))));
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 429) return null; // free quota used up: never fall through to anything paid
      if (!res.ok) continue;
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return checked(JSON.parse(text), kinds);
    } catch {
      // A busy or slow model: try the next one.
    }
  }
  return null;
}

/** Keeps only what fits the shop's lists and lengths. */
export function checked(raw: unknown, kinds: { id: Category }[]): Described {
  // Models sometimes wrap the answer in a list.
  const r = ((Array.isArray(raw) ? raw[0] : raw) ?? {}) as Record<string, unknown>;
  const out: Described = {};
  const name = clean(r.name, 60).replace(/[^\p{L}\p{N} '&-]/gu, "");
  if (name) out.name = name;
  if (kinds.some((k) => k.id === r.category)) out.category = r.category as Category;
  if (FITS.includes(r.fit as Fit)) out.fit = r.fit as Fit;
  if (GENDERS.includes(r.gender as Gender)) out.gender = r.gender as Gender;
  const line = clean(r.shortDescription, 140);
  if (line && !/\d+\s*(rs|npr|%)|rupee/i.test(line)) out.shortDescription = line;
  if (Array.isArray(r.details)) out.details = r.details.map((d) => clean(d, 80)).filter((d) => d && !/\d+\s*(gsm|%)/i.test(d)).slice(0, 4);
  const colour = clean(r.colour, 24).replace(/[^\p{L} -]/gu, "");
  if (colour) out.colour = colour.charAt(0).toUpperCase() + colour.slice(1).toLowerCase();
  if (Array.isArray(r.tags)) out.tags = [...new Set(r.tags.map((t) => clean(t, 24).toLowerCase().replace(/[^a-z0-9 -]/g, "")).filter(Boolean))].slice(0, 6);
  return out;
}
