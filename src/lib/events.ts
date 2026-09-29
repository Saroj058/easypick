import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { getCurrentUser, secret } from "./auth";
import { getDb, schema } from "./db";
import { ktmDay } from "./ktm-day";
import { clientIp } from "./rate-limit";

// What people look at and want, for Trending. Each person counts once per product, kind
// and day. Signed-in people are counted by account; everyone else by a hash of today's
// date and their network details, which can't be turned back into who they are and
// changes every day. No cookie is set.

export const EVENT_KINDS = ["view", "bag", "save", "restock"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

async function actorForToday(day: string) {
  const user = await getCurrentUser();
  if (user) return `u:${user.id}`;
  const ua = (await headers()).get("user-agent") ?? "";
  return `v:${createHmac("sha256", secret()).update(`${day}|${await clientIp()}|${ua}`).digest("base64url").slice(0, 22)}`;
}

/** Records one event; repeats by the same person on the same day are ignored. Never throws. */
export async function recordEvent(productSlug: string, kind: EventKind) {
  try {
    const day = ktmDay();
    const actor = await actorForToday(day);
    const db = await getDb();
    await db.insert(schema.productEvents).values({ productSlug, kind, actor, day }).onConflictDoNothing();
  } catch (e) {
    console.error("[events] couldn't record", kind, productSlug, e);
  }
}
