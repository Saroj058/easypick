import { describe, expect, it } from "vitest";

import { numbers, num, pick, text } from "@/lib/settings/clean";
import { cleanHome, DEFAULT_HOME, HOME_SECTIONS } from "@/lib/settings/home-rules";
import { announcing, cleanSite, DEFAULT_SITE, socialLinks } from "@/lib/settings/site-rules";

describe("settings helpers", () => {
  it("clamp, cap and fall back", () => {
    expect(num("7", 1, 2, 5)).toBe(5);
    expect(num("x", 3, 2, 5)).toBe(3);
    expect(text("  hi  ", "d", 1)).toBe("h");
    expect(text(4, "d")).toBe("d");
    expect(pick(["b", "a", "b", "z"], ["a", "b"] as const, ["a"])).toEqual(["b", "a"]);
    expect(numbers(["2500", 1000, -5, "x", 1000], [1], 100, 100000)).toEqual([1000, 2500]);
    expect(numbers([], [1], 100, 100000)).toEqual([1]);
  });
});

describe("home page settings", () => {
  it("a missing or broken value gives the page as built", () => {
    expect(cleanHome(null)).toEqual(DEFAULT_HOME);
    expect(cleanHome("nope")).toEqual(DEFAULT_HOME);
  });

  it("keeps the saved order, adds sections it doesn't know about, and drops unknown ones", () => {
    const h = cleanHome({ sections: [{ id: "vault", on: false }, { id: "hero", on: true }, { id: "bogus", on: true }] });
    expect(h.sections.slice(0, 2)).toEqual([
      { id: "vault", on: false },
      { id: "hero", on: true },
    ]);
    expect(h.sections.map((s) => s.id).sort()).toEqual([...HOME_SECTIONS].sort());
  });

  it("never leaves a label blank or a list empty", () => {
    const h = cleanHome({ hero: { visitLabel: "   ", kinds: ["nope"] }, rail: { bays: [{ name: "X", kinds: [] }], budgets: [] }, vault: { title: "" } });
    expect(h.hero.visitLabel).toBe(DEFAULT_HOME.hero.visitLabel);
    expect(h.hero.kinds).toEqual(DEFAULT_HOME.hero.kinds);
    expect(h.rail.bays).toEqual(DEFAULT_HOME.rail.bays);
    expect(h.rail.budgets).toEqual(DEFAULT_HOME.rail.budgets);
    expect(h.vault.title).toBe("The Vault");
  });

  it("allows an empty eyebrow (it hides the line)", () => {
    expect(cleanHome({ hero: { eyebrow: "" } }).hero.eyebrow).toBe("");
  });
});

describe("site settings", () => {
  it("only keeps web links or paths", () => {
    const s = cleanSite({ social: { instagram: "https://instagram.com/x", tiktok: "javascript:alert(1)" }, announcement: { on: true, text: "Hi", link: "/shop?sale=1", until: "2026-10-30" } });
    expect(s.social.instagram).toBe("https://instagram.com/x");
    expect(s.social.tiktok).toBe("");
    expect(s.announcement.link).toBe("/shop?sale=1");
    expect(socialLinks(s)).toEqual([{ name: "Instagram", href: "https://instagram.com/x" }]);
  });

  it("shows the announcement only while switched on, with text, until its last day", () => {
    const s = cleanSite({ announcement: { on: true, text: "Hi", until: "2026-10-30" } });
    expect(announcing(s, "2026-10-30")).toBe(true);
    expect(announcing(s, "2026-10-31")).toBe(false);
    expect(announcing(DEFAULT_SITE, "2026-10-01")).toBe(false);
  });
});
