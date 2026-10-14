import { brain } from "@/lib/pick/ai";
import type { Quick } from "@/lib/pick/journey";
import { turn, type PickInput } from "@/lib/pick/turn";
import { allow, clientIp } from "@/lib/rate-limit";
import { getProducts } from "@/lib/store";

// Pick, the gift page's robot: one chat turn. The browser sends what Pick knows so far (only gift
// preferences) and the customer's button or message; the answer comes from lib/pick/turn.ts.
// Typed messages may be read by the AI (lib/pick/ai.ts); buttons never are. Nothing is stored.

const MAX_BODY = 8_000;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "too-big" }, { status: 413 });
  let body: { state?: unknown; start?: unknown; quick?: unknown; text?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad-json" }, { status: 400 });
  }

  const ip = await clientIp();
  // A generous cap on every turn, and a tighter one on turns that use the AI.
  if (!(await allow(`pick:${ip}`, 240, 10 * 60_000))) return Response.json({ error: "slow-down" }, { status: 429 });

  let input: PickInput;
  if (body.start === true) input = { start: true };
  else if (typeof body.text === "string" && body.text.trim()) input = { text: body.text.trim().slice(0, 400) };
  else if (body.quick && typeof body.quick === "object") input = { quick: cleanQuick(body.quick) };
  else return Response.json({ error: "nothing-to-do" }, { status: 400 });

  const ai = "text" in input && (await allow(`pick-ai:${ip}`, 40, 10 * 60_000)) ? brain() : null;
  const products = await getProducts();
  const reply = await turn(products, body.state, input, ai ? (text, known) => ai.understand(text, known) : undefined);
  return Response.json(reply);
}

/** A button as sent by the browser: only its label, its values and its action, all checked again in turn(). */
function cleanQuick(q: object): Quick {
  const r = q as Record<string, unknown>;
  const out: Quick = { label: typeof r.label === "string" ? r.label.slice(0, 60) : "" };
  if (typeof r.action === "string") out.action = r.action as Quick["action"];
  if (r.set && typeof r.set === "object") {
    const s = r.set as Record<string, unknown>;
    const set: NonNullable<Quick["set"]> = {};
    for (const k of ["recipient", "occasion", "style", "sizing", "size"] as const) if (typeof s[k] === "string") set[k] = (s[k] as string).slice(0, 20);
    if (typeof s.budget === "number") set.budget = s.budget;
    out.set = set;
  }
  return out;
}
