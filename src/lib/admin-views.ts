import "server-only";

import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { allProducts } from "./catalogue";
import { getDb, schema } from "./db";

// More read-only views for the admin (owner, 17 Oct 2026: "put all the control"): search across
// orders, pieces and customers; the customer list; the drop-alert list and the restock requests.
// Nothing here changes data. (lib/admin-data.ts has the activity log and gift cards.)

/** Customers, newest first, with how many orders each has placed (paid ones). Optional search by name, phone or email. */
export async function listCustomers(q = "", limit = 200) {
  const db = await getDb();
  const term = q.trim().slice(0, 60);
  const like = `%${term.replace(/[%_]/g, "")}%`;
  const paid = db
    .select({ userId: schema.orders.userId, n: count().as("n"), spent: sql<number>`coalesce(sum(${schema.orders.total}),0)::int`.as("spent") })
    .from(schema.orders)
    .where(sql`${schema.orders.paidAt} is not null`)
    .groupBy(schema.orders.userId)
    .as("paid");
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      phone: schema.users.phone,
      email: schema.users.email,
      alerts: schema.users.alerts,
      google: sql<boolean>`${schema.users.googleId} is not null`,
      createdAt: schema.users.createdAt,
      lastLoginAt: schema.users.lastLoginAt,
      orders: sql<number>`coalesce(${paid.n},0)::int`,
      spent: sql<number>`coalesce(${paid.spent},0)::int`,
    })
    .from(schema.users)
    .leftJoin(paid, eq(paid.userId, schema.users.id))
    .where(term ? or(ilike(schema.users.name, like), ilike(schema.users.phone, like), ilike(schema.users.email, like)) : undefined)
    .orderBy(desc(schema.users.createdAt))
    .limit(limit);
}

export async function customerCount() {
  const db = await getDb();
  const [r] = await db.select({ n: count() }).from(schema.users);
  return r?.n ?? 0;
}

/** People on the drop-alert list (still subscribed), newest first. */
export async function dropAlertList(limit = 500) {
  const db = await getDb();
  return db
    .select({
      id: schema.dropAlertSubscribers.id,
      channel: schema.dropAlertSubscribers.channel,
      contact: schema.dropAlertSubscribers.contact,
      source: schema.dropAlertSubscribers.source,
      consentAt: schema.dropAlertSubscribers.consentAt,
      lastDropSent: schema.dropAlertSubscribers.lastDropSent,
    })
    .from(schema.dropAlertSubscribers)
    .where(isNull(schema.dropAlertSubscribers.unsubscribedAt))
    .orderBy(desc(schema.dropAlertSubscribers.consentAt))
    .limit(limit);
}

/** How many have stopped the alerts. */
export async function dropAlertStopped() {
  const db = await getDb();
  const [r] = await db.select({ n: count() }).from(schema.dropAlertSubscribers).where(sql`${schema.dropAlertSubscribers.unsubscribedAt} is not null`);
  return r?.n ?? 0;
}

/** "Tell me when it's back" requests still waiting, grouped by size: the piece, size, colour, how many asked and since when. */
export async function restockWaiting() {
  const db = await getDb();
  const rows = await db
    .select({
      slug: schema.restockAlerts.slug,
      sku: schema.restockAlerts.sku,
      size: schema.restockAlerts.size,
      colour: schema.restockAlerts.colour,
      n: count(),
      first: sql<string>`min(${schema.restockAlerts.createdAt})`,
    })
    .from(schema.restockAlerts)
    .where(isNull(schema.restockAlerts.notifiedAt))
    .groupBy(schema.restockAlerts.slug, schema.restockAlerts.sku, schema.restockAlerts.size, schema.restockAlerts.colour)
    .orderBy(desc(count()));
  const products = await allProducts();
  return rows.map((r) => {
    const p = products.find((x) => x.slug === r.slug);
    const v = p?.variants.find((x) => x.sku === r.sku);
    return { ...r, name: p?.name ?? r.slug, stock: v?.stock ?? 0 };
  });
}

/** Pieces whose name, slug, brand or a SKU matches. */
export async function searchPieces(q: string, limit = 12) {
  const t = q.trim().toLowerCase();
  if (t.length < 2) return [];
  const products = await allProducts();
  return products
    .filter((p) => p.name.toLowerCase().includes(t) || p.slug.includes(t) || (p.brand ?? "").toLowerCase().includes(t) || p.variants.some((v) => v.sku.toLowerCase() === t))
    .slice(0, limit);
}

/** A customer by id, with their latest login (for the search results). */
export async function findCustomer(id: string) {
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(and(eq(schema.users.id, id))).limit(1);
  return u ?? null;
}
