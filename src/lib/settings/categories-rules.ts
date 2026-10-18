import { categoryLabels, KIND_ICON } from "../site";
import type { Category } from "../types";
import { bool, label, obj, text } from "./clean";

// The kinds of piece as the owner sets them in Admin → Categories (owner, 18 Oct 2026): their
// names, order, picture, a line about each, and whether the shop shows them. The twelve kinds
// themselves (and the outfit rules behind them) stay in code; this is how they're shown.

export const STAND_IN_PICTURES = ["tee", "pocket-tee", "hoodie", "crewneck", "quarter-zip", "jacket", "jeans", "jogger", "cargo", "shorts", "set", "cap"] as const;

export interface KindSetting {
  id: Category;
  label: string;
  visible: boolean;
  /** A stand-in picture key ("hoodie"), or an uploaded picture's address. */
  icon: string;
  blurb: string;
}

const IDS = Object.keys(categoryLabels) as Category[];

export const DEFAULT_KINDS: KindSetting[] = IDS.map((id) => ({ id, label: categoryLabels[id], visible: true, icon: KIND_ICON[id], blurb: "" }));

function icon(v: unknown, fallback: string): string {
  const t = text(v, fallback, 300);
  if ((STAND_IN_PICTURES as readonly string[]).includes(t)) return t;
  if (/^https:\/\//.test(t) || t.startsWith("/")) return t;
  return fallback;
}

export function cleanKinds(raw: unknown): KindSetting[] {
  const list = Array.isArray(raw) ? raw : obj(raw).kinds;
  const out: KindSetting[] = [];
  if (Array.isArray(list))
    for (const r of list) {
      const o = obj(r);
      const id = o.id as Category;
      if (!IDS.includes(id) || out.some((x) => x.id === id)) continue;
      out.push({ id, label: label(o.label, categoryLabels[id], 30), visible: bool(o.visible, true), icon: icon(o.icon, KIND_ICON[id]), blurb: text(o.blurb, "", 120) });
    }
  for (const d of DEFAULT_KINDS) if (!out.some((x) => x.id === d.id)) out.push(d);
  return out;
}

/** The picture's address: a stand-in key becomes /stand-ins/<key>.webp. */
export const kindPicture = (icon: string) => (icon.startsWith("/") || icon.startsWith("https://") ? icon : `/stand-ins/${icon}.webp`);

/** A quick lookup for pages: shown kinds in order, and a name for any kind. */
export function kindView(kinds: KindSetting[]) {
  const by = new Map(kinds.map((k) => [k.id, k]));
  return {
    order: kinds.filter((k) => k.visible).map((k) => k.id),
    all: kinds.map((k) => k.id),
    name: (id: Category) => by.get(id)?.label ?? categoryLabels[id],
    picture: (id: Category) => kindPicture(by.get(id)?.icon ?? KIND_ICON[id]),
    blurb: (id: Category) => by.get(id)?.blurb ?? "",
    visible: (id: Category) => by.get(id)?.visible !== false,
  };
}
