import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { getDb, schema } from "@/lib/db";
import { dropAlertCounts, dropDueSoon, subscribeToDrops, syncAccountAlerts, unsubscribeFromDrops } from "@/lib/drop-alerts";
import { effectiveStatus } from "@/lib/product-status";
import type { Drop } from "@/lib/types";

let db: Awaited<ReturnType<typeof getDb>>;
beforeAll(async () => {
  db = await getDb();
});

const row = async (contact: string) => (await db.select().from(schema.dropAlertSubscribers).where(eq(schema.dropAlertSubscribers.contact, contact)))[0];

describe("drop alert sign-ups", () => {
  it("saves a sign-up once, with when they agreed and a stop link", async () => {
    const email = `a-${Date.now()}@example.com`;
    const token = await subscribeToDrops("email", email, "test");
    const again = await subscribeToDrops("email", email, "test");
    expect(again).toBe(token); // the same person signing up twice keeps one row and one link
    const saved = await row(email);
    expect(saved).toMatchObject({ channel: "email", unsubscribedAt: null, lastDropSent: null });
    expect(Date.parse(saved.consentAt)).toBeGreaterThan(Date.now() - 60_000);
  });

  it("stops with the link, and signing up again re-opens it", async () => {
    const phone = `98${String(Date.now()).slice(-8)}`;
    const token = await subscribeToDrops("whatsapp", phone, "test");
    expect(await unsubscribeFromDrops("not-a-real-token")).toBe(false);
    expect(await unsubscribeFromDrops(token)).toBe(true);
    expect((await row(phone)).unsubscribedAt).not.toBeNull();
    await subscribeToDrops("whatsapp", phone, "test");
    expect((await row(phone)).unsubscribedAt).toBeNull();
  });

  it("follows the account page's tick", async () => {
    const email = `b-${Date.now()}@example.com`;
    const before = await dropAlertCounts();
    await syncAccountAlerts(true, email, "9800000000");
    expect((await dropAlertCounts()).email).toBe(before.email + 1);
    await syncAccountAlerts(false, email, null);
    expect((await dropAlertCounts()).email).toBe(before.email);
  });
});

describe("the drop that's about to open", () => {
  const drop = (slug: string, releaseAt: string): Drop => ({ slug, name: `Drop ${slug}`, story: "", releaseAt, pieceCount: 10 });
  const now = Date.parse("2026-10-02T16:45:00+05:45"); // a Friday afternoon

  it("is the one opening in the next few hours", () => {
    const drops = [drop("06", "2026-09-18T18:00:00+05:45"), drop("07", "2026-10-02T18:00:00+05:45"), drop("08", "2026-10-16T18:00:00+05:45")];
    expect(dropDueSoon(drops, now)?.slug).toBe("07");
  });

  it("is nothing on an ordinary day or once it has opened", () => {
    expect(dropDueSoon([drop("08", "2026-10-16T18:00:00+05:45")], now)).toBeNull();
    expect(dropDueSoon([drop("07", "2026-10-02T18:00:00+05:45")], Date.parse("2026-10-02T18:01:00+05:45"))).toBeNull();
  });
});

describe("sold out", () => {
  const v = (stock: number, lastPieceOnFloor = false) => ({ sku: "x", size: "M" as const, colour: "Black", stock, lastPieceOnFloor });

  it("shows a live piece with nothing left as sold out", () => {
    expect(effectiveStatus({ status: "live", dropSlug: null, variants: [v(0), v(0)] }, [])).toBe("sold_out");
    expect(effectiveStatus({ status: "live", dropSlug: null, variants: [v(0), v(2)] }, [])).toBe("live");
  });

  it("keeps a piece live when its last one is on the shop floor", () => {
    expect(effectiveStatus({ status: "live", dropSlug: null, variants: [v(1, true)] }, [])).toBe("live");
  });
});
