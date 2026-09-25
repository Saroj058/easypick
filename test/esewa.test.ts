import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyEsewa } from "@/lib/gateways";

// eSewa's published test merchant (sandbox only).
const SECRET = "8gBm/:&EnhH.1/q";

function reply(fields: Record<string, string>, secret = SECRET) {
  const names = "transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names";
  const d: Record<string, string> = { ...fields, product_code: "EPAYTEST", signed_field_names: names };
  d.signature = createHmac("sha256", secret)
    .update(names.split(",").map((f) => `${f}=${d[f] ?? ""}`).join(","))
    .digest("base64");
  return Buffer.from(JSON.stringify(d)).toString("base64");
}

const statusApi = (body: object) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body))));
const base = { transaction_code: "0007ABC", status: "COMPLETE", total_amount: "999.0", transaction_uuid: "EP-1000001-abcd1234" };

afterEach(() => vi.unstubAllGlobals());

describe("eSewa replies", () => {
  it("accepts a signed reply that eSewa's status API confirms", async () => {
    statusApi({ status: "COMPLETE", ref_id: "0007ABC", total_amount: 999 });
    const r = await verifyEsewa(reply(base), async () => 999);
    expect(r).toEqual({ ok: true, ref: base.transaction_uuid, amount: 999, gatewayRef: "0007ABC" });
  });

  it("rejects a reply signed with the wrong key (a forged 'paid')", async () => {
    statusApi({ status: "COMPLETE" });
    const r = await verifyEsewa(reply(base, "not-the-key"), async () => 999);
    expect(r).toMatchObject({ ok: false, code: "bad_reply" });
  });

  it("rejects a reply whose fields were changed after signing", async () => {
    const d = JSON.parse(Buffer.from(reply(base), "base64").toString());
    d.total_amount = "1.0";
    const r = await verifyEsewa(Buffer.from(JSON.stringify(d)).toString("base64"), async () => 999);
    expect(r).toMatchObject({ ok: false, code: "bad_reply" });
  });

  it("doesn't trust the redirect: the status API must say COMPLETE", async () => {
    statusApi({ status: "PENDING" });
    expect(await verifyEsewa(reply(base), async () => 999)).toMatchObject({ ok: false, code: "not_complete" });
    statusApi({ status: "CANCELED" });
    expect(await verifyEsewa(reply(base), async () => 999)).toMatchObject({ ok: false, code: "cancelled" });
  });

  it("says so when the order isn't ours", async () => {
    statusApi({ status: "COMPLETE" });
    expect(await verifyEsewa(reply(base), async () => null)).toMatchObject({ ok: false, code: "no_order" });
  });

  it("handles garbage", async () => {
    expect(await verifyEsewa("%%%not-base64", async () => 999)).toMatchObject({ ok: false, code: "bad_reply" });
  });
});
