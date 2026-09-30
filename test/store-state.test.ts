import { describe, expect, it } from "vitest";

import { parseStoreForm } from "@/lib/store-form";
import { DEFAULT_STORE, hourLabel, storeState, withDefaults, type StoreInfo } from "@/lib/store-state";

// 2 Oct 2026 is a Friday. Times are Kathmandu (+05:45).
const at = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00+05:45`);
const open: StoreInfo = { ...DEFAULT_STORE, opened: true, address: "Jhamsikhel Road", hours: DEFAULT_STORE.hours.map((h) => ({ ...h, open: "11:00", close: "20:00", closed: false })) };

describe("store state", () => {
  it("shows Coming soon until the owner switches the store to Open", () => {
    const s = storeState({ ...DEFAULT_STORE, opened: false, openingDate: "2027-02-14" }, at("2026-10-02", "12:00"));
    expect(s).toMatchObject({ kind: "soon", headline: "Opening February 2027", openingAt: "2027-02-14T11:00:00+05:45" });
    // Past the date but still not switched on: no countdown to a day that's gone.
    expect(storeState({ ...DEFAULT_STORE, openingDate: "2026-09-01" }, at("2026-10-02", "12:00"))).toMatchObject({ kind: "soon", openingAt: null });
  });

  it("is open during opening hours, in Kathmandu time", () => {
    expect(storeState(open, at("2026-10-02", "11:00"))).toMatchObject({ kind: "open", headline: "Aaunus. Open till 8 PM." });
    expect(storeState(open, at("2026-10-02", "19:59")).kind).toBe("open");
  });

  it("says when it opens next once it's closed", () => {
    expect(storeState(open, at("2026-10-02", "20:00")).headline).toBe("Shutter down. Opens 11 AM tomorrow.");
    expect(storeState(open, at("2026-10-02", "09:30")).headline).toBe("Shutter down. Opens 11 AM today.");
    const sundaysOff = { ...open, hours: open.hours.map((h) => (h.day === 0 ? { ...h, closed: true } : h)) };
    expect(storeState(sundaysOff, at("2026-10-03", "21:00")).headline).toBe("Shutter down. Opens 11 AM Monday.");
  });

  it("shows festival closures with their note and the day it's back", () => {
    const tika = { ...open, special: [0, 1, 2].map((n) => ({ date: `2026-10-2${1 + n}`, closed: true, note: "Closed for Tika" })) };
    expect(storeState(tika, at("2026-10-21", "12:00"))).toMatchObject({ kind: "closed", headline: "Closed for Tika. Back Saturday." });
  });

  it("uses special hours for a day instead of the weekly ones", () => {
    const short = { ...open, special: [{ date: "2026-10-02", closed: false, open: "11:00", close: "15:00", note: "Short day" }] };
    expect(storeState(short, at("2026-10-02", "14:00")).headline).toBe("Aaunus. Open till 3 PM.");
    expect(storeState(short, at("2026-10-02", "16:00")).kind).toBe("closed");
  });

  it("half-opens the shutter on drop day until the drop", () => {
    const drop = "2026-10-02T18:00:00+05:45";
    expect(storeState(open, at("2026-10-02", "12:00"), drop)).toMatchObject({ kind: "drop", headline: "Drop at 6 PM." });
    expect(storeState(open, at("2026-10-02", "18:30"), drop).kind).toBe("open");
    expect(storeState(open, at("2026-10-01", "12:00"), drop).kind).toBe("open");
  });

  it("fills in sample details only for the preview", () => {
    expect(withDefaults(null).route).toHaveLength(0);
    const p = withDefaults(null, true);
    expect(p.opened).toBe(true);
    expect(p.route.length).toBeGreaterThan(0);
    expect(p.address).toMatch(/sample/);
  });

  it("labels hours the way people say them", () => {
    expect(hourLabel("20:00")).toBe("8 PM");
    expect(hourLabel("10:30")).toBe("10:30 AM");
    expect(hourLabel("12:00")).toBe("12 PM");
  });
});

describe("admin store form", () => {
  const base = () => {
    const f = new FormData();
    for (let d = 0; d < 7; d++) {
      f.set(`open-${d}`, "11:00");
      f.set(`close-${d}`, "20:00");
    }
    f.set("area", "Jhamsikhel");
    return f;
  };

  it("reads hours, special days and the route", () => {
    const f = base();
    f.set("closed-0", "on");
    f.append("sDate", "2026-10-22");
    f.append("sKind", "closed");
    f.append("sOpen", "");
    f.append("sClose", "");
    f.append("sNote", "Closed for Tika");
    f.append("rText", "Jhamsikhel Chowk");
    f.append("rMin", "0");
    f.append("rText", "");
    f.append("rMin", "");
    f.set("lat", "27.6844");
    f.set("lng", "85.3066");
    const r = parseStoreForm(f);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.info.hours[0].closed).toBe(true);
    expect(r.info.special).toEqual([{ date: "2026-10-22", closed: true, note: "Closed for Tika" }]);
    expect(r.info.route).toEqual([{ text: "Jhamsikhel Chowk", minutes: 0 }]);
    expect(r.info.geo).toEqual({ lat: 27.6844, lng: 85.3066 });
  });

  it("refuses closing before opening, a pin outside Nepal, and Open without an address", () => {
    const f1 = base();
    f1.set("close-3", "10:00");
    expect(parseStoreForm(f1)).toMatchObject({ ok: false, message: expect.stringMatching(/Wednesday/) });
    const f2 = base();
    f2.set("lat", "85.3");
    f2.set("lng", "27.7");
    expect(parseStoreForm(f2).ok).toBe(false);
    const f3 = base();
    f3.set("opened", "on");
    expect(parseStoreForm(f3)).toMatchObject({ ok: false, message: expect.stringMatching(/address/) });
  });
});
