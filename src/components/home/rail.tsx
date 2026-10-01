import { sellable } from "@/lib/inventory";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import type { Category, Product, Size } from "@/lib/types";
import { RailWall, type RailColour, type RailPiece, type RailSection } from "./rail-wall";

const BUDGETS = [1000, 1500, 2500];
const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];
/** A section holds three or four pieces; smaller kinds share a section with the next one. */
const SECTION_MIN = 3;
const SECTION_SHOWN = 4;

// The rail: the live pieces laid out like the shop wall, in the order an outfit goes on
// (see rail-wall.tsx for how it looks and works).

/** The wall, top to bottom. */
const BAYS: { name: string; caption: string; kinds: Category[] }[] = [
  { name: "Tops", caption: "Start on top", kinds: ["tees", "hoodies", "co-ords"] },
  { name: "Jackets", caption: "Layer up", kinds: ["jackets"] },
  { name: "Bottoms", caption: "Bottom half", kinds: ["bottoms"] },
  { name: "Extras", caption: "Finish", kinds: ["accessories"] },
];

/** "Tops", "Bottoms and extras"; three or more kinds on one rail are "The rest of the fit". */
function listed(names: string[]) {
  const rest = names.slice(1).map((n) => n.toLowerCase());
  if (rest.length === 0) return names[0];
  if (rest.length >= 2) return "The rest of the fit";
  return `${[names[0], ...rest.slice(0, -1)].join(", ")} and ${rest[rest.length - 1]}`;
}

function toPiece(p: Product): RailPiece {
  const colours: RailColour[] = p.colours.map((c) => ({
    name: c.name,
    hex: c.hex,
    sizes: p.variants
      .filter((v) => v.colour === c.name)
      .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size))
      .map((v) => ({ size: v.size, sku: v.sku, left: sellable(v) })),
  }));
  const buyable = colours.filter((c) => c.sizes.some((s) => s.left > 0));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.salePrice ?? p.price,
    was: p.salePrice ? p.price : undefined,
    image: p.images[0] ?? { src: null, alt: p.name, kind: "front" },
    back: p.images[1],
    measurements: p.measurements,
    colours: buyable.length ? buyable : colours,
    fit: p.fit,
    gender: p.gender,
    tags: p.tags,
    status: p.status,
  };
}

export function Rail({ products }: { products: Product[] }) {
  const live = products.filter((p) => p.status === "live").sort((a, b) => (b.liveAt ?? "").localeCompare(a.liveAt ?? ""));
  if (live.length === 0) return null;

  // One bay per part of the outfit, then small bays joined to the next until a section holds enough.
  const bays = BAYS.map((b) => ({ ...b, kinds: b.kinds.filter((k) => live.some((p) => p.category === k)) }))
    .filter((b) => b.kinds.length > 0)
    .map((b) => ({ names: [b.name], captions: [b.caption], kinds: b.kinds, pieces: b.kinds.flatMap((k) => live.filter((p) => p.category === k)) }));
  const joined: typeof bays = [];
  for (const bay of bays) {
    const last = joined[joined.length - 1];
    if (last && last.pieces.length < SECTION_MIN) {
      last.names.push(...bay.names);
      last.captions.push(...bay.captions);
      last.kinds.push(...bay.kinds);
      last.pieces.push(...bay.pieces);
    } else joined.push({ names: [...bay.names], captions: [...bay.captions], kinds: [...bay.kinds], pieces: [...bay.pieces] });
  }
  // A short last section goes with the one before it, when together they still fit on one rail.
  if (joined.length > 1) {
    const end = joined[joined.length - 1];
    const before = joined[joined.length - 2];
    if (end.pieces.length < SECTION_MIN && before.pieces.length + end.pieces.length <= SECTION_SHOWN) {
      before.names.push(...end.names);
      before.captions.push(...end.captions);
      before.kinds.push(...end.kinds);
      before.pieces.push(...end.pieces);
      joined.pop();
    }
  }

  const sections: RailSection[] = joined.map((s) => ({
    key: s.kinds.join("-"),
    label: listed(s.names),
    caption: s.captions.join(" · "),
    href: s.kinds.length === 1 ? `/shop?category=${s.kinds[0]}` : "/shop",
    total: s.pieces.length,
    // A few more than a rail shows, so a budget or the sort still fills it.
    pieces: s.pieces.slice(0, SECTION_SHOWN * 3).map(toPiece),
  }));

  const prices = live.map((p) => p.salePrice ?? p.price);
  // Only budgets that narrow the rail: at least one piece under it, and not every piece.
  const budgets = BUDGETS.filter((b) => {
    const n = prices.filter((x) => x < b).length;
    return n > 0 && n < prices.length;
  });

  return (
    <section aria-labelledby="rail-title" className="pt-12 md:pt-20">
      <div className="container-ep">
        <RailWall
          sections={sections}
          budgets={budgets}
          pieces={live.length}
          facts={["Fixed price", "Pay with eSewa", "Free pickup", `Delivery ${formatPrice(site.delivery.flatFee)}`]}
        />
      </div>
    </section>
  );
}
