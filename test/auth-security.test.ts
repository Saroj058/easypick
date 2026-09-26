import { describe, expect, it, vi } from "vitest";

import { requestCode, safeNext, verifyCode } from "@/lib/auth";

// No request here: every call looks like the same visitor with no cookies.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
import { mergeBag, MAX_PER_SKU, MAX_PIECES } from "@/lib/bag-rules";
import { jsonLd } from "@/lib/json-ld";
import { sniffImage } from "@/lib/photos";
import { ipFromHeaders, ipKey } from "@/lib/rate-limit";

describe("safeNext", () => {
  it("keeps normal paths on this site", () => {
    expect(safeNext("/checkout")).toBe("/checkout");
    expect(safeNext("/product/tee?size=M#fit")).toBe("/product/tee?size=M#fit");
    expect(safeNext("/")).toBe("/");
  });
  it("rejects anything a browser would read as another site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r//evil.com", "/.//evil.com", "https://evil.com", "evil.com", "", null, 42]) {
      expect(safeNext(bad)).toBe("/account");
    }
  });
  it("leaves encoded slashes as plain path text", () => {
    expect(safeNext("/%2F/evil.com")).toBe("/%2F/evil.com");
    expect(safeNext("/%5Cevil.com")).toBe("/%5Cevil.com");
  });
  it("uses the given fallback", () => {
    expect(safeNext("//x", "/")).toBe("/");
  });
});

describe("client IP keys", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  it("ignores forwarded headers off Vercel (a visitor could type them)", () => {
    expect(ipFromHeaders(h({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" }), false)).toBe("local");
  });
  it("uses the platform headers on Vercel", () => {
    expect(ipFromHeaders(h({ "x-real-ip": "1.2.3.4" }), true)).toBe("1.2.3.4");
    expect(ipFromHeaders(h({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }), true)).toBe("5.6.7.8");
    expect(ipFromHeaders(h({}), true)).toBe("local");
  });
  it("groups IPv6 by /64", () => {
    expect(ipKey("2400:1a00:b020:1234:aaaa:bbbb:cccc:dddd")).toBe("2400:1a00:b020:1234::/64");
    expect(ipKey("2400:1a00:b020:1234::1")).toBe(ipKey("2400:1a00:b020:1234:ffff::9"));
    expect(ipKey("2400:1A00:0B20:0034::1")).toBe("2400:1a00:b20:34::/64");
    expect(ipKey("[2400:1a00:b020:1234::1]:443")).toBe("2400:1a00:b020:1234::/64");
    expect(ipKey("::1")).toBe("0:0:0:0::/64");
  });
  it("keeps IPv4 as is", () => {
    expect(ipKey("1.2.3.4")).toBe("1.2.3.4");
    expect(ipKey("1.2.3.4:5678")).toBe("1.2.3.4");
    expect(ipKey("::ffff:1.2.3.4")).toBe("1.2.3.4");
  });
});

describe("bag limits", () => {
  const line = (sku: string, qty: number) => ({ slug: "tee", sku, name: "Tee", qty });
  it("merges lines of the same piece", () => {
    const r = mergeBag([line("A", 2), line("B", 1), line("A", 1)]);
    expect(r).toEqual({ ok: true, lines: [{ ...line("A", 3) }, { ...line("B", 1) }] });
  });
  it("caps each piece after merging", () => {
    const r = mergeBag([line("A", 3), line("A", 3)]);
    expect(r.ok).toBe(false);
    expect(mergeBag([line("A", MAX_PER_SKU)]).ok).toBe(true);
  });
  it("caps the whole bag", () => {
    const four = ["A", "B", "C", "D"].map((s) => line(s, 4)); // 16 pieces
    expect(mergeBag(four).ok).toBe(false);
    expect(mergeBag(four.slice(0, 3).concat(line("D", MAX_PIECES - 12))).ok).toBe(true);
  });
  it("Buy now is one piece of the first line", () => {
    expect(mergeBag([line("A", 5), line("B", 2)], { buyNow: true })).toEqual({ ok: true, lines: [line("A", 1)] });
  });
  it("rejects junk", () => {
    for (const bad of [null, [], "x", [{}], [{ slug: "t", sku: 1, qty: 1 }], [line("A", 0)], [line("A", -2)], [line("A", Number.NaN)]]) {
      expect(mergeBag(bad).ok).toBe(false);
    }
    expect(mergeBag([line("A", 1), { ...line("A", 1), slug: "other" }]).ok).toBe(false);
  });
});

describe("uploads and page data", () => {
  it("knows images by their bytes, not their claimed type", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImage(new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]))).toBe("image/webp");
    expect(sniffImage(new Uint8Array([...Buffer.from("<svg onload=alert(1)>")]))).toBeNull();
  });
  it("JSON-LD can't close its script tag", () => {
    const html = jsonLd({ name: "</script><script>alert(1)</script>" }).__html;
    expect(html).not.toContain("<");
    expect(JSON.parse(html).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("login codes (database)", () => {
  it("sends only one code when several requests arrive at once", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const phone = `98${String(Date.now()).slice(-8)}`;
    const results = await Promise.all([requestCode(phone), requestCode(phone), requestCode(phone)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("limits wrong codes per visitor, across numbers", async () => {
    const { getDb, schema } = await import("@/lib/db");
    const db = await getDb();
    await db.delete(schema.rateLimits);
    const base = 9700000000 + (Date.now() % 100_000) * 10;
    let last = "";
    for (let i = 0; i < 21; i++) {
      const phone = String(base + (i % 7));
      const otp = { hash: "x", expiresAt: Date.now() + 60_000, triesLeft: 3 };
      await db
        .insert(schema.otps)
        .values({ phone, ...otp, sentAt: [] })
        .onConflictDoUpdate({ target: schema.otps.phone, set: otp });
      const r = await verifyCode(phone, "000000");
      last = r.ok ? "" : r.message;
    }
    expect(last).toMatch(/from this device/);
    await db.delete(schema.rateLimits);
  });
});
