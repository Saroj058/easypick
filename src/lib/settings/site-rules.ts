import { bool, label, obj, text } from "./clean";

// Site-wide settings the owner sets in Admin → Site settings (owner, 18 Oct 2026): social links,
// a short announcement under the header, what search engines show, and the footer's sign-up box.
// Money settings (delivery fee, wallets) stay in code until the owner says how to change them.

export interface SiteSettings {
  social: { instagram: string; tiktok: string; facebook: string; youtube: string };
  announcement: { on: boolean; text: string; link: string; until: string };
  seo: { description: string };
  footer: { alertsOn: boolean; alertsTitle: string; alertsNote: string };
}

export const DEFAULT_SITE: SiteSettings = {
  social: { instagram: "", tiktok: "", facebook: "", youtube: "" },
  announcement: { on: false, text: "", link: "", until: "" },
  seo: { description: "Self-checkout streetwear and everyday basics in Kathmandu. Fair fixed prices, new drops every other Friday. Pay with eSewa." },
  footer: { alertsOn: true, alertsTitle: "Drop alerts", alertsNote: "One message on each drop day. Every message has a link to stop." },
};

/** Only http(s) links, or a path on this site. */
function url(v: unknown): string {
  const t = text(v, "", 300);
  if (!t) return "";
  if (t.startsWith("/")) return t;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

export function cleanSite(raw: unknown): SiteSettings {
  const r = obj(raw);
  const s = obj(r.social);
  const a = obj(r.announcement);
  const seo = obj(r.seo);
  const f = obj(r.footer);
  const d = DEFAULT_SITE;
  const until = text(a.until, "", 10);
  return {
    social: { instagram: url(s.instagram), tiktok: url(s.tiktok), facebook: url(s.facebook), youtube: url(s.youtube) },
    announcement: { on: bool(a.on, false), text: text(a.text, "", 120), link: url(a.link), until: /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : "" },
    seo: { description: label(seo.description, d.seo.description, 300) },
    footer: { alertsOn: bool(f.alertsOn, true), alertsTitle: label(f.alertsTitle, d.footer.alertsTitle, 40), alertsNote: text(f.alertsNote, d.footer.alertsNote, 160) },
  };
}

/** Whether the announcement shows today (Kathmandu date, YYYY-MM-DD). */
export const announcing = (s: SiteSettings, today: string) => s.announcement.on && Boolean(s.announcement.text) && (!s.announcement.until || s.announcement.until >= today);

/** The social links that are filled in, in a fixed order, with their names. */
export function socialLinks(s: SiteSettings): { name: string; href: string }[] {
  return (
    [
      ["Instagram", s.social.instagram],
      ["TikTok", s.social.tiktok],
      ["Facebook", s.social.facebook],
      ["YouTube", s.social.youtube],
    ] as const
  )
    .filter(([, href]) => href)
    .map(([name, href]) => ({ name, href }));
}
