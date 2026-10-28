import type { Metadata } from "next";

import { featuredVault, toTile, vaultBrands, vaultHref, vaultPieces } from "@/components/home/vault";
import { brandKey, brandWorld, MONO, priceStep, themeVars, two, V } from "@/components/vault/look";
import { VaultBento, VaultStatement } from "@/components/vault/vault-bento";
import { VaultBrandGrid } from "@/components/vault/vault-brand-grid";
import { VaultHero } from "@/components/vault/vault-hero";
import { VaultInventory } from "@/components/vault/vault-inventory";
import { VaultSpotlight } from "@/components/vault/vault-spotlight";
import { VaultTriptych } from "@/components/vault/vault-triptych";
import { vaultSetting } from "@/lib/settings/vault";
import { getProducts } from "@/lib/store";
import { HowItWorks } from "@/components/how-it-works";

export const revalidate = 60;

// The person standing in front of the title: the Vault's own, and one per brand as they're made.
// Made with Higgsfield (owner, 25 Oct 2026): our own pictures, no brand marks on them.
const FIGURES: Record<string, { src: string; width: number; height: number }> = {
  all: { src: "/vault/hero-figure.webp", width: 410, height: 925 },
  nike: { src: "/vault/hero-nike.webp", width: 738, height: 1100 },
  adidas: { src: "/vault/hero-adidas.webp", width: 326, height: 1100 },
};

export const metadata: Metadata = {
  title: "The Vault",
  description: "Original brands at Easypick, Kathmandu. One of each piece, never restocked.",
  alternates: { canonical: "/vault" },
};

// The Vault, cold (owner, 18 Oct 2026, from the FRZN reference): a frost-blue page with the name
// set big, then a slate panel: three pieces side by side that glide through on their own, one piece
// floating over the words as you scroll, then everything as notched ice tiles with brand tabs and
// filters, and the Vault list to close. A brand's own page (?brand=Nike) opens on that brand.
export default async function VaultPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const wanted = Array.isArray(sp.brand) ? sp.brand[0] : sp.brand;
  const [all, vs] = await Promise.all([getProducts(), vaultSetting.get()]);
  const pieces = vaultPieces(all);
  const brands = vaultBrands(pieces);
  const one = wanted ? brands.find((b) => b.name.toLowerCase() === wanted.toLowerCase()) : undefined;
  const list = one ? one.pieces : pieces;
  const sold = pieces.filter((p) => p.status === "sold_out").length;
  // The pieces the owner put first (Admin → The Vault), then the usual pick.
  const pinned = vs.featured.flatMap((slug) => list.filter((p) => p.slug === slug));
  const featured = [...pinned, ...featuredVault(list.filter((p) => !pinned.includes(p)), 5)].slice(0, 5).map((p, i) => toTile(p, i));
  // The spotlight: a different piece from the one the triptych opens on, one that can be bought.
  const spot = featured.slice(1).find((t) => !t.sold) ?? featured.find((t) => !t.sold) ?? featured[0];
  const tiles = list.map((p, i) => toTile(p, i));
  // The shortcuts at the top open the pieces already filtered: ?left=1, ?under=5000, ?last=1.
  const cap = priceStep(tiles.filter((t) => !t.sold).map((t) => t.price));
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);
  const under = Number(pick("under"));
  const start = { avail: pick("left") === "1", under: under > 0 ? under : undefined, last: pick("last") === "1" };
  // Each brand wears its own colours and tells its own story; "All" is the Vault's cold blue.
  const world = brandWorld(one?.name, vs.brands);

  return (
    // Premium, like the big fashion houses (owner, 25 Oct 2026: "make it premium like LV, Gucci"):
    // every headline in the thin cut with wide spacing, lots of air, no busy watermark text.
    <div style={themeVars(MONO)} className={`vault relative isolate min-h-[80svh] overflow-x-clip ${V.frost} pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0 [&_.display]:font-extralight [&_.display]:tracking-[0.04em]`}>
      {/* The opening, in black and white: the name huge, one piece in front of it (owner, 25 Oct 2026) */}
      <VaultHero
        title={one ? one.name : "The Vault"}
        note={world ? `${world.origin}. ${world.line[0]} ${world.line[1]}` : vs.copy.intro}
        pieces={featured}
        count={`${two(brands.length)} brands · ${two(pieces.length)} pieces${sold ? ` · ${two(sold)} sold` : ""}`}
        side="Shop the Vault"
        figure={(one && FIGURES[brandKey(one.name)]) || FIGURES.all}
      />

      {/* Under the opening, after the "FWD" reference (owner, 26 Oct 2026): rounded panels on the
          page's grey. A black statement, the real numbers as cards, the brands as numbered cards,
          then the pieces in one big rounded black panel. */}
      <div className="pb-4 md:pb-6">
        {/* About the Vault, then the brands, then every piece, then buying from the Vault (owner, 27 Oct 2026) */}
        <div className="px-3 pt-3 md:px-4 md:pt-4">
          <VaultStatement
            statement={world ? `${world.line[0]} ${world.line[1]}` : `${vs.copy.left[0]} ${vs.copy.left[1]}`}
            sub={world ? world.story : "Every piece comes in with its invoice and is looked over by hand before it reaches the wall."}
          />
        </div>
        <div className="px-5 pt-4 md:px-6">
          <HowItWorks guide="vault" />
        </div>
        {brands.length > 0 && (
          <section id="vault-brands" aria-label="Brands" className="scroll-mt-24 px-3 pt-3 md:px-4 md:pt-4">
            <p className="px-2 pb-3 text-[12px] leading-relaxed text-[#666]">Brand names describe the pieces. Easypick is an independent store, not an official seller of these brands.</p>
            <VaultBrandGrid
              total={pieces.length}
              active={one?.name}
              brands={brands.map((b) => ({ name: b.name, n: b.pieces.length, href: vaultHref(b.name), origin: brandWorld(b.name, vs.brands)?.origin ?? "Original brand", from: Math.min(...b.pieces.filter((p) => p.status !== "sold_out").map((p) => p.salePrice ?? p.price)), left: b.pieces.filter((p) => p.status !== "sold_out").length, kinds: Array.from(new Set(b.pieces.map((p) => p.category))).map((k) => k.charAt(0).toUpperCase() + k.slice(1).replace("-", " ")) }))}
            />
          </section>
        )}
        {/* Every piece, under the brands */}
        {pieces.length > 0 && (
          <div className="px-3 pt-3 md:px-4 md:pt-4">
            <div className={`overflow-hidden rounded-[28px] ${V.slate} text-white [&_.display]:!font-sans [&_.display]:!font-semibold [&_.display]:!normal-case [&_.display]:!tracking-[-0.035em]`}>
              <div className="container-ep pb-16 pt-4 md:pb-24">
                {wanted && !one && <p className={`pt-8 text-[15px] ${V.iceDim}`}>Nothing from &ldquo;{wanted}&rdquo; right now. Here&apos;s the rest of the Vault.</p>}
                <div id="inventory" className="scroll-mt-28 pt-12 md:pt-16">
                  <VaultInventory key={`${start.avail}-${start.under}-${start.last}`} tiles={tiles} brand={one?.name} start={start} />
                </div>
              </div>
            </div>
          </div>
        )}
        <VaultBento
          available={tiles.filter((t) => !t.sold).length}
          under={cap ? { cap, n: tiles.filter((t) => !t.sold && t.price <= cap).length } : null}
          last={tiles.filter((t) => t.last).length}
          base={vaultHref(one?.name)}
          figure={(one && FIGURES[brandKey(one.name)]) || FIGURES.all}
        />


        {/* The pieces, in one big rounded black panel */}
        <div className="px-3 pt-3 md:px-4 md:pt-4">
          {/* Its headlines in the same bold, tight sans as the cards above */}
          <div className={`overflow-hidden rounded-[28px] ${V.slate} text-white [&_.display]:!font-sans [&_.display]:!font-semibold [&_.display]:!normal-case [&_.display]:!tracking-[-0.035em]`}>
            <div className="container-ep pb-16 pt-4 md:pb-24">
              {pieces.length === 0 ? (
                <p className={`py-24 text-center text-[17px] ${V.iceDim}`}>The wall is empty for now. The first pieces arrive soon.</p>
              ) : (
                <>
                  <div className="pt-12 md:pt-16">
                    <VaultTriptych key={one?.name ?? "all"} pieces={featured} />
                  </div>
                  <div className="mt-14 border-t border-white/10 md:mt-20">{spot && <VaultSpotlight piece={spot} />}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
