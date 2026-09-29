import { EVENT_KINDS, recordEvent, type EventKind } from "@/lib/events";
import { allow, clientIp } from "@/lib/rate-limit";
import { getProduct } from "@/lib/store";

export const dynamic = "force-dynamic";

// Browser-side signals for Trending: a product page view, an add to bag, a save.
// Restock requests are recorded on the server when they're made.
const FROM_BROWSER: EventKind[] = ["view", "bag", "save"];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { slug?: unknown; kind?: unknown } | null;
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const kind = body?.kind as EventKind;
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !EVENT_KINDS.includes(kind) || !FROM_BROWSER.includes(kind)) return new Response(null, { status: 400 });
  // Generous per-visitor ceiling: a real shopper never gets near it, a script can't flood the table.
  if (!(await allow(`events:${await clientIp()}`, 600, 60 * 60_000))) return new Response(null, { status: 429 });
  if (!(await getProduct(slug))) return new Response(null, { status: 404 });
  await recordEvent(slug, kind);
  return new Response(null, { status: 204 });
}
