import type { Metadata } from "next";
import { LayoutGrid, Sparkles, Tag } from "lucide-react";
import Link from "next/link";

import { RecentlyViewed } from "@/components/local-lists";
import { formatPrice } from "@/lib/format";
import { sellable } from "@/lib/inventory";
import { PickChat } from "@/components/gift/pick-chat";
import { toRailPiece } from "@/components/home/rail";
import { ShopSearch } from "@/components/shop-search";
import { ShopShelf } from "@/components/shop-shelf";
import { OfferCards } from "@/components/offer-cards";
import { ktmDay } from "@/lib/ktm-day";
import { inOffer, liveOffers, running } from "@/lib/offer-rules";
import { getOffers } from "@/lib/offers";
import { categoryLabels, KIND_ICON } from "@/lib/site";
import { getProducts } from "@/lib/store";
import type { Category, Fit, Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Oversized tees, hoodies, joggers, jeans and jackets at fixed fair prices. Streetwear in Kathmandu, with live stock by size.",
  alternates: { canonical: "/shop" },
};

// "Under" chips are what the home rail links to; the old band key still works for shared links.
const prices = [
  { key: "u1000", label: "Under Rs 1,000", test: (n: number) => n < 1000, chip: true },
  { key: "u1500", label: "Under Rs 1,500", test: (n: number) => n < 1500, chip: true },
  { key: "u2500", label: "Under Rs 2,500", test: (n: number) => n < 2500, chip: true },
  { key: "o2500", label: "Over Rs 2,500", test: (n: number) => n > 2500, chip: true },
  { key: "1000-2500", label: "Rs 1,000–2,500", test: (n: number) => n >= 1000 && n <= 2500, chip: false },
];

const fits: { key: Fit; label: string }[] = [
  { key: "oversized", label: "Oversized" },
  { key: "relaxed", label: "Relaxed" },
  { key: "regular", label: "Regular" },
];

const sorts = [
  { key: "new", label: "Newest" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
];

type Filters = { q?: string; category?: string; size?: string; colour?: string; price?: string; fit?: string; sort?: string; sale?: string; new?: string; vault?: string; brand?: string; offer?: string; page?: string };

/** Pieces per page: enough to browse, small enough for a phone on mobile data. */

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function href(current: Filters, change: Partial<Filters>) {
  const next = { ...current, ...change };
  const q = new URLSearchParams();
  // Changing a filter starts again from page 1.
  if (!("page" in change)) delete next.page;
  for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/shop?${s}` : "/shop";
}

function Chip({ active, href: to, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-11 shrink-0 items-center rounded-[2px] border px-4 text-sm font-semibold ${
        active ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"
      }`}
    >
      {children}
    </Link>
  );
}


/**
 * A kind of piece, as on the gift page (owner, 17 Oct 2026): a rounded button with a little picture
 * of the garment and how many there are; the chosen one in ink.
 */
function KindChip({ active, href: to, count, icon, children }: { active: boolean; href: string; count?: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-[13px] font-semibold transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] ${
        active ? "border-ink bg-ink text-paper" : "border-ink/15 bg-paper hover:border-ink"
      }`}
    >
      {icon}
      {children}
      {count !== undefined && (
        <sup aria-hidden className={`font-mono text-[10px] ${active ? "text-paper/70" : "text-steel-dark"}`}>
          {count}
        </sup>
      )}
    </Link>
  );
}

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const sp = await searchParams;
  const f: Filters = {
    q: one(sp.q)?.trim().slice(0, 60) || undefined,
    category: one(sp.category),
    size: one(sp.size),
    colour: one(sp.colour),
    price: one(sp.price),
    sort: one(sp.sort),
    fit: one(sp.fit),
    sale: one(sp.sale) === "1" ? "1" : undefined,
    new: one(sp.new) === "1" ? "1" : undefined,
    vault: one(sp.vault) === "1" ? "1" : undefined,
    brand: one(sp.brand),
    offer: one(sp.offer),
    page: one(sp.page),
  };

  const [all, offerList] = await Promise.all([getProducts(), getOffers()]);
  // Festival offers running today, and the one being looked at (an ended or unknown one is ignored).
  const offers = liveOffers(offerList, all, ktmDay());
  const offer = offerList.find((o) => o.id === f.offer && running(o, ktmDay()));
  if (!offer) f.offer = undefined;
  const colours = Array.from(new Set(all.flatMap((p) => p.colours.map((c) => c.name)))).sort();
  const sizes = ["S", "M", "L", "XL"];

  const priceOf = (p: Product) => p.salePrice ?? p.price;
  let list = all.filter((p) => p.status !== "scheduled");
  // Search: every word typed has to be somewhere in the piece's name, kind, colours, fit, brand or tags.
  const words = (f.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length)
    list = list.filter((p) => {
      const hay = [p.name, p.shortDescription, categoryLabels[p.category], p.fit, p.brand ?? "", ...p.colours.map((c) => c.name), ...(p.tags ?? [])].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  if (f.sale) list = list.filter((p) => p.salePrice);
  if (offer) list = list.filter((p) => inOffer(offer, p));
  if (f.new) list = list.filter((p) => p.isNew);
  if (f.vault) list = list.filter((p) => p.vault);
  if (f.brand) list = list.filter((p) => p.brand?.toLowerCase() === f.brand?.toLowerCase());
  // One kind, or several from a rail section (tees,hoodies,co-ords).
  const kinds = (f.category?.split(",") ?? []).filter((c): c is Category => c in categoryLabels);
  if (kinds.length) list = list.filter((p) => kinds.includes(p.category));
  if (f.fit) list = list.filter((p) => p.fit === f.fit);
  if (f.colour) list = list.filter((p) => p.colours.some((c) => c.name === f.colour));
  // One-size pieces (caps) fit every size, the same as on the home rail.
  if (f.size) list = list.filter((p) => p.variants.some((v) => (v.size === f.size || v.size === "ONE") && sellable(v) > 0));
  const priceRule = prices.find((x) => x.key === f.price);
  if (priceRule) list = list.filter((p) => priceRule.test(priceOf(p)));
  if (f.sort === "price-asc") list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
  else if (f.sort === "price-desc") list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
  // Sold out sinks to the bottom, but keeps its page for sharing and search.
  list = [...list].sort((a, b) => Number(a.status === "sold_out") - Number(b.status === "sold_out"));

  const active = Boolean(f.q || f.category || f.size || f.colour || f.price || f.fit || f.sale || f.new || f.vault || f.brand || f.offer);
  const anyNew = all.some((p) => p.isNew && p.status !== "scheduled");
  const onSale = all.filter((p) => p.salePrice && p.status === "live");
  const bestSaving = onSale.reduce((n, p) => Math.max(n, p.price - (p.salePrice ?? p.price)), 0);

  // As the rails and the gift page (owner, 15 Oct 2026): "All" is a strip per kind of piece; one
  // kind chosen (or a search, sale, new, Vault or brand view) is one strip under its big name.
  const single = kinds.length === 1 || Boolean(f.q || f.sale || f.new || f.vault || f.brand || offer);
  const groups = (Object.keys(categoryLabels) as Category[])
    .map((c) => ({ c, pieces: list.filter((p) => p.category === c) }))
    .filter((g) => g.pieces.length > 0);
  const title = offer ? offer.name : f.brand ? f.brand : f.vault ? "The Vault" : f.sale ? "On sale" : f.new ? "New in" : f.q ? `“${f.q}”` : kinds.length === 1 ? categoryLabels[kinds[0]] : "Every piece";

  return (
    <div className="overflow-x-clip">
      <div className="container-ep pb-24 pt-10 md:pt-16">
        {/* One bar, like the home page's Rail: the name on a black tab, the same search button, and Filter (its panel drops below the bar) */}
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-2xl border border-ink py-2 pr-3">
          <h1 className="display on-dark order-1 -my-2 -ml-px flex items-center self-stretch rounded-tl-[15px] bg-ink px-5 py-3 text-[34px] leading-[0.9] text-paper md:text-[44px]">
            {/* The kind, offer or view chosen is named large on its shelf below, as on the rail. */}
            {single ? "Shop" : kinds.length ? kinds.map((c) => categoryLabels[c]).join(", ") : "Shop all"}
          </h1>
          {/* Search: the Rail's round button, opening into a field that searches as they type */}
          <ShopSearch q={f.q ?? ""} others={{ category: f.category, size: f.size, colour: f.colour, price: f.price, fit: f.fit, sort: f.sort, sale: f.sale, new: f.new, vault: f.vault, brand: f.brand, offer: f.offer }} />
          <details className="group order-2 lg:order-3">
            <summary aria-label="Filter and sort" className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-mist px-4 text-sm font-semibold transition-colors hover:border-ink group-open:border-ink [&::-webkit-details-marker]:hidden">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
                <circle cx="16" cy="7" r="2" />
                <circle cx="8" cy="17" r="2" />
              </svg>
              Filter {active && <span className="tag-volt">On</span>}
            </summary>
            <div className="absolute inset-x-[-1px] top-full z-20 grid gap-6 border border-ink bg-paper p-5 shadow-[0_18px_30px_-20px_rgba(0,0,0,0.35)] md:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="text-sm font-semibold">Size</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <Chip key={s} active={f.size === s} href={href(f, { size: f.size === s ? undefined : s })}>
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Colour</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {colours.map((c) => (
                    <Chip key={c} active={f.colour === c} href={href(f, { colour: f.colour === c ? undefined : c })}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Price</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prices.filter((p) => p.chip).map((p) => (
                    <Chip key={p.key} active={f.price === p.key} href={href(f, { price: f.price === p.key ? undefined : p.key })}>
                      {p.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Fit</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {fits.map((x) => (
                    <Chip key={x.key} active={f.fit === x.key} href={href(f, { fit: f.fit === x.key ? undefined : x.key })}>
                      {x.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Sort</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sorts.map((s) => (
                    <Chip key={s.key} active={(f.sort ?? "new") === s.key} href={href(f, { sort: s.key === "new" ? undefined : s.key })}>
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>
        {f.sale && bestSaving > 0 && <p className="mt-2 text-steel-dark">Festival prices on {onSale.length} pieces, up to {formatPrice(bestSaving)} off. While stock lasts.</p>}
  
        <div className="space-y-3">
          {/* The kinds: joined to the bar above, as on the gift page; they wrap so none hides */}
          <div className="flex items-center gap-3 rounded-b-2xl border border-t-0 border-ink px-3 py-2.5 md:px-4">
            <div
              className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto [mask-image:linear-gradient(90deg,#000_calc(100%-28px),transparent)] md:flex-wrap md:overflow-visible md:[mask-image:none]"
              role="group"
              aria-label="Category"
            >
              <KindChip active={!f.category && !f.sale && !f.new && !f.offer} href={href(f, { category: undefined, sale: undefined, new: undefined, offer: undefined })} icon={<LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={1.8} />}>
                All
              </KindChip>
              {onSale.length > 0 && (
                <KindChip active={Boolean(f.sale || f.offer)} href={href(f, { sale: f.sale || f.offer ? undefined : "1", offer: undefined })} count={onSale.length} icon={<Tag aria-hidden className="h-4 w-4" strokeWidth={1.8} />}>
                  On sale
                </KindChip>
              )}
              {anyNew && (
                <KindChip active={Boolean(f.new)} href={href(f, { new: f.new ? undefined : "1" })} icon={<Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.8} />}>
                  New in
                </KindChip>
              )}
              {(Object.keys(categoryLabels) as Category[])
                .filter((c) => f.category === c || all.some((p) => p.category === c && p.status !== "scheduled"))
                .map((c) => (
                  <KindChip
                    key={c}
                    active={f.category === c}
                    href={href(f, { category: c })}
                    count={all.filter((p) => p.category === c && p.status !== "scheduled").length}
                    icon={
                      // eslint-disable-next-line @next/next/no-img-element -- a tiny garment picture, already compressed
                      <img src={`/stand-ins/${KIND_ICON[c]}.webp`} alt="" className={`h-6 w-6 object-contain ${f.category === c ? "brightness-[3]" : "opacity-80"}`} />
                    }
                  >
                    {categoryLabels[c]}
                  </KindChip>
                ))}
            </div>
            <p className={`hidden shrink-0 font-mono text-[12px] tabular-nums text-steel-dark ${active ? "" : "md:block"}`} aria-hidden>
              {list.length} {list.length === 1 ? "piece" : "pieces"}
            </p>
          </div>
  
          {active && (
            <ul aria-label="Filters on" className="flex flex-wrap gap-2">
              {(
                [
                  ["q", f.q && `“${f.q}”`],
                  ["size", f.size && `Size ${f.size}`],
                  ["colour", f.colour],
                  ["price", prices.find((x) => x.key === f.price)?.label],
                  ["fit", fits.find((x) => x.key === f.fit)?.label],
                  ["brand", f.brand],
                  ["offer", offer?.name],
                  ["vault", f.vault && "The Vault"],
                ] as [keyof Filters, string | undefined][]
              )
                .filter(([, label]) => label)
                .map(([key, label]) => (
                  <li key={key}>
                    <Link
                      href={href(f, { [key]: undefined })}
                      scroll={false}
                      className="inline-flex h-11 items-center gap-2 rounded-[2px] bg-photo px-3 text-[13px] font-semibold hover:bg-mist"
                    >
                      {label}
                      <span aria-hidden>×</span>
                      <span className="sr-only">, remove filter</span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
  
        </div>
  
        <p className={`mt-6 font-mono text-[13px] text-steel-dark ${active ? "" : "md:hidden"}`} aria-live="polite">
          {list.length} {list.length === 1 ? "piece" : "pieces"}
          {active && (
            <>
              {" · "}
              <Link href={href({ sort: f.sort }, {})} className="underline">
                Clear filters
              </Link>
            </>
          )}
        </p>
  
        {/* Festival offers: on the sale view and each offer's own page, the offers running now side by side. */}
        {(f.sale || offer) && offers.length > 0 && (
          <div className="mt-6">
            <OfferCards offers={offers} active={offer?.id} />
          </div>
        )}

        {/* Pick, the robot: for themselves first, gifts too; sizes, delivery, swaps and small talk */}
        <div className="mt-12 md:mt-16">
          <PickChat where="shop" />
        </div>
  
        <div className="mt-6 overflow-x-clip">
          {!list.length ? (
            <p className="py-24 text-center text-steel-dark">{f.q ? `Nothing matches “${f.q}”. Try another word, or clear the filters.` : "Nothing matches that yet. Try another size or colour."}</p>
          ) : single ? (
            <ShopShelf
              id="one"
              first
              label={title}
              pieces={list.map(toRailPiece)}
              showAll={kinds.length === 1 || f.sale || f.new ? href(f, { category: undefined, sale: undefined, new: undefined }) : undefined}
              showAllLabel="Every kind"
            />
          ) : (
            <div>
              {groups.map(({ c, pieces }, i) => (
                <ShopShelf key={c} id={c} first={i === 0} label={categoryLabels[c]} pieces={pieces.map(toRailPiece)} showAll={href(f, { category: c })} />
              ))}
            </div>
          )}
        </div>
        <RecentlyViewed />
      </div>
    </div>
  );
}
