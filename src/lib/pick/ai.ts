import "server-only";

import { OCCASIONS, RECIPIENTS, SIZES, STYLES, type PickAction, type PickState, type Quick } from "./journey";

// Pick's reading of free text. The model only turns the customer's words into the same fields the
// buttons set (who it's for, occasion, style, budget, size) plus one short, warm line. It never
// chooses products, quotes prices or states policies: those come from the catalogue and the site
// settings. Everything it returns is checked against fixed lists before it is used.
//
// Provider: Google Gemini (GEMINI_API_KEY, server only). Model: PICK_AI_MODEL, else the "lite"
// models, which answer fastest on the free tier. Set PICK_AI=off to run without it (tests do).
// Swap the provider by writing another `Brain` and returning it from `brain()`.

export interface Understanding {
  set: NonNullable<Quick["set"]>;
  action?: PickAction;
  /** One short line in Pick's voice, or nothing. Never contains numbers (so never a price). */
  reply?: string;
}

interface Brain {
  understand(message: string, known: PickState): Promise<Understanding | null>;
}

const INTENTS = ["answer", "more", "cheaper", "compare", "restart", "fit", "delivery", "offtopic", "unclear"] as const;
const TIMEOUT_MS = 6000;
/** After the free quota runs out, stop asking for a while: never fall through to a paid service. */
const QUOTA_PAUSE_MS = 10 * 60_000;
let pausedUntil = 0;

const SYSTEM = `You are Pick, the small robot who helps people choose clothing gifts at Easypick, a streetwear store in Kathmandu.
Read the customer's message and fill only the fields they actually stated or clearly implied. Never guess a field they did not mention.
- recipient: partner (boyfriend, girlfriend, husband, wife), friend, family, self, someone (anyone else).
- occasion: birthday, anniversary, valentine, festival (Dashain, Tihar, Bhai Tika and other festivals), thanks, just-because, other.
- style: street (streetwear, oversized, baggy), minimal (clean, simple, neutral), casual (everyday, comfy), premium (branded, luxury), bold (bright, colourful), unsure.
- budget: their top spend in Nepali rupees as a whole number, only if they gave one. "3k" is 3000. 0 means no limit.
- sizing: unknown if they said they don't know the size; known if they gave one.
- size: XS, S, M, L, XL or XXL, only if stated.
- intent: answer (they gave preferences), more (more options), cheaper, compare, restart, fit (what if it doesn't fit, exchanges), delivery (delivery, sending it to them), offtopic, unclear.
reply: one or two short sentences (under 25 words) in Pick's voice: warm, clever, a little playful, never pushy or salesy.
In reply, never mention prices, numbers, products, discounts, delivery times or store policies, and never promise anything. Acknowledge what they said; if offtopic, answer in a few friendly words and steer back to the gift.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    recipient: { type: "STRING", enum: [...RECIPIENTS] },
    occasion: { type: "STRING", enum: [...OCCASIONS] },
    style: { type: "STRING", enum: [...STYLES] },
    budget: { type: "INTEGER" },
    sizing: { type: "STRING", enum: ["known", "unknown"] },
    size: { type: "STRING", enum: [...SIZES] },
    intent: { type: "STRING", enum: [...INTENTS] },
    reply: { type: "STRING" },
  },
  required: ["intent", "reply"],
};

/** Checks the model's JSON field by field. Anything unexpected is dropped, not trusted. */
export function validate(raw: unknown): Understanding | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const set: Understanding["set"] = {};
  const oneOf = (v: unknown, list: readonly string[]) => (typeof v === "string" && list.includes(v) ? v : undefined);
  const recipient = oneOf(r.recipient, RECIPIENTS);
  const occasion = oneOf(r.occasion, OCCASIONS);
  const style = oneOf(r.style, STYLES);
  const sizing = oneOf(r.sizing, ["known", "unknown"]);
  const size = oneOf(r.size, SIZES);
  if (recipient) set.recipient = recipient;
  if (occasion) set.occasion = occasion;
  if (style) set.style = style;
  if (sizing) set.sizing = sizing;
  if (size) set.size = size;
  if (typeof r.budget === "number" && Number.isInteger(r.budget) && r.budget >= 0 && r.budget <= 1_000_000) set.budget = r.budget;
  const intent = oneOf(r.intent, INTENTS);
  const action: PickAction | undefined = intent && ["more", "cheaper", "compare", "restart", "fit", "delivery"].includes(intent) ? (intent as PickAction) : undefined;
  let reply = typeof r.reply === "string" ? r.reply.replace(/\s+/g, " ").trim() : "";
  // No numbers (so no invented prices or days), no links, nothing long.
  if (!reply || /\d|https?:|www\.|rs\.?\s|npr|rupee/i.test(reply) || reply.length > 220) reply = "";
  return { set, action, reply: reply || undefined };
}

function gemini(key: string): Brain {
  const models = Array.from(new Set([process.env.PICK_AI_MODEL, "gemini-flash-lite-latest", "gemini-3.5-flash-lite"].filter((m): m is string => Boolean(m && /^[a-z0-9.-]{3,60}$/.test(m)))));
  return {
    async understand(message, known) {
      if (Date.now() < pausedUntil) return null;
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: `Already known: ${JSON.stringify(known)}\nCustomer: ${message}` }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.6, maxOutputTokens: 300 },
      });
      // One try per model: a busy model (503) moves on to the next; a used-up quota (429) stops.
      for (const model of models) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": key },
            body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (res.status === 429) {
            pausedUntil = Date.now() + QUOTA_PAUSE_MS;
            console.warn("[pick] AI quota reached; pausing AI for 10 minutes");
            return null;
          }
          if (!res.ok) {
            console.warn(`[pick] AI ${model} answered ${res.status}`);
            continue;
          }
          const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
          const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
          return validate(JSON.parse(text));
        } catch (e) {
          console.warn(`[pick] AI ${model} failed: ${e instanceof Error ? e.name : "error"}`);
        }
      }
      return null;
    },
  };
}

/** The configured brain, or null when there is none (then Pick reads messages with simple rules). */
export function brain(): Brain | null {
  if (process.env.PICK_AI === "off") return null;
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? gemini(key) : null;
}
