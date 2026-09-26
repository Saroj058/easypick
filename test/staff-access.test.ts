import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { getDb, schema } from "@/lib/db";
import { deliverOnText, helperEvents, packLines } from "@/lib/helper-view";
import type { Order } from "@/lib/orders";
import { addStaff, changeStaffLogin, removeStaff, reservedUsername, resetStaffPassword, signOutStaffEverywhere } from "@/lib/staff";

// Staff accounts: names that can't be taken, never losing the last owner, and owner resets.

let db: Awaited<ReturnType<typeof getDb>>;

async function makeStaff(role: "owner" | "helper", password = "a-good-password-1") {
  const username = `t${randomUUID().slice(0, 8)}`;
  const res = await addStaff(username, password, role);
  expect(res.ok).toBe(true);
  const [row] = await db.select().from(schema.staff).where(eq(schema.staff.username, username));
  return row;
}

beforeAll(async () => {
  db = await getDb();
});

describe("reserved usernames", () => {
  it("are refused in any case when adding someone", async () => {
    for (const name of ["system", "SYSTEM", "Owner", "admin", "customer", "Receiver", "staff", "EasyPick"]) {
      expect(reservedUsername(name)).toBe(true);
      const res = await addStaff(name, "a-good-password-1", "helper");
      expect(res.ok).toBe(false);
    }
    expect(reservedUsername("saroj")).toBe(false);
  });

  it("are refused when renaming yourself", async () => {
    const me = await makeStaff("helper");
    const res = await changeStaffLogin(me.id, "a-good-password-1", { username: "System" });
    expect(res).toMatchObject({ ok: false, field: "username" });
    const [row] = await db.select().from(schema.staff).where(eq(schema.staff.id, me.id));
    expect(row.username).toBe(me.username);
  });
});

describe("removing staff", () => {
  it("never removes yourself", async () => {
    const a = await makeStaff("owner");
    expect((await removeStaff(a.id, a.id)).ok).toBe(false);
  });

  it("keeps one owner even when the last two remove each other at the same moment", async () => {
    // Make these two the only owners.
    const others = await db.select({ id: schema.staff.id }).from(schema.staff).where(eq(schema.staff.role, "owner"));
    if (others.length) await db.update(schema.staff).set({ role: "helper" }).where(inArray(schema.staff.id, others.map((o) => o.id)));
    const a = await makeStaff("owner");
    const b = await makeStaff("owner");
    const [ra, rb] = await Promise.all([removeStaff(b.id, a.id), removeStaff(a.id, b.id)]);
    expect([ra.ok, rb.ok].filter(Boolean)).toHaveLength(1);
    const owners = await db.select().from(schema.staff).where(eq(schema.staff.role, "owner"));
    expect(owners).toHaveLength(1);
  });

  it("removes a helper", async () => {
    const owner = await makeStaff("owner");
    const helper = await makeStaff("helper");
    expect(await removeStaff(helper.id, owner.id)).toEqual({ ok: true, username: helper.username });
    expect(await db.select().from(schema.staff).where(eq(schema.staff.id, helper.id))).toHaveLength(0);
  });
});

describe("owner resets", () => {
  it("a new password signs them out everywhere", async () => {
    const owner = await makeStaff("owner");
    const helper = await makeStaff("helper");
    const res = await resetStaffPassword(helper.id, owner.id, "brand-new-password");
    expect(res.ok).toBe(true);
    const [row] = await db.select().from(schema.staff).where(eq(schema.staff.id, helper.id));
    expect(row.sessionVersion).toBe(helper.sessionVersion + 1);
    expect(row.passwordHash).not.toBe(helper.passwordHash);
    // The old password no longer works; the new one does.
    expect((await changeStaffLogin(helper.id, "a-good-password-1", { username: helper.username })).ok).toBe(false);
    expect((await changeStaffLogin(helper.id, "brand-new-password", { username: helper.username })).ok).toBe(true);
  });

  it("refuses short passwords and your own account", async () => {
    const owner = await makeStaff("owner");
    const helper = await makeStaff("helper");
    expect((await resetStaffPassword(helper.id, owner.id, "short")).ok).toBe(false);
    expect((await resetStaffPassword(owner.id, owner.id, "brand-new-password")).ok).toBe(false);
  });

  it("sign out everywhere bumps the session version only", async () => {
    const owner = await makeStaff("owner");
    const helper = await makeStaff("helper");
    expect((await signOutStaffEverywhere(helper.id, owner.id)).ok).toBe(true);
    const [row] = await db.select().from(schema.staff).where(eq(schema.staff.id, helper.id));
    expect(row.sessionVersion).toBe(helper.sessionVersion + 1);
    expect(row.passwordHash).toBe(helper.passwordHash);
  });
});

describe("helper view of an order", () => {
  const base = {
    id: "x",
    number: "EP-1000001",
    phone: "9800000000",
    method: "pickup",
    provider: "esewa",
    subtotal: 3000,
    deliveryFee: 0,
    total: 3000,
    status: "paid",
    createdAt: "2026-09-01T00:00:00Z",
    expiresAt: "2026-09-01T00:15:00Z",
    lines: [
      { sku: "A", slug: "a", name: "A", size: "M", colour: "Black", unitPrice: 1000, qty: 2 },
      { sku: "B", slug: "b", name: "B", size: "L", colour: "White", unitPrice: 1000, qty: 1 },
    ],
  } as Order;

  it("packs qty minus refunded and drops fully refunded lines", () => {
    const o: Order = { ...base, refunds: [{ at: "", by: "o", amount: 2000, toGiftCard: 0, skus: ["A", "B"], lines: [{ i: 0, qty: 1 }, { i: 1, qty: 1 }] }] };
    expect(packLines(o).map((l) => [l.sku, l.toPack, l.refunded])).toEqual([["A", 1, 1]]);
  });

  it("hides refund and payment events", () => {
    const events = ["Order placed", "Paid with esewa (REF1)", "Needs attention: Paid twice", "Refunded Rs 1,000, wallet ref X", "Cancelled and refunded Rs 3,000", "Packed", "Exchanged A: Black M → Black L", "Turned into gift card GC-SECRET"].map((what) => ({ at: "", by: "x", what }));
    expect(helperEvents(events).map((e) => e.what)).toEqual(["Order placed", "Packed", "Exchanged A: Black M → Black L", "Turned into a gift card (nothing to pack)"]);
  });

  it("shows the gift date as a Kathmandu day", () => {
    const o = { ...base, gift: { deliverOn: "2026-10-03" } } as unknown as Order;
    const d = deliverOnText(o, new Date("2026-09-26T00:00:00Z"));
    expect(d?.text).toMatch(/^Deliver on Sat 3 Oct/);
    expect(d?.future).toBe(true);
    expect(deliverOnText(o, new Date("2026-10-03T20:00:00Z"))?.future).toBe(false);
  });
});
