import type { Metadata } from "next";

import { featuredVault, toTile, vaultBrands, vaultHref, vaultPieces } from "@/components/home/vault";
import { brandKey, brandWorld, MONO, themeVars, two, V } from "@/components/vault/look";
import { VaultBento } from "@/components/vault/vault-bento";
import { VaultBrandGrid } from "@/components/vault/vault-brand-grid";
import { VaultHero } from "@/components/vault/vault-hero";
import { VaultInventory } from "@/components/vault/vault-inventory";
import { VaultSpotlight } from "@/components/vault/vault-spotlight";
import { VaultTriptych } from "@/components/vault/vault-triptych";
import { vaultSetting } from "@/lib/settings/vault";
import { getProducts } from "@/lib/store";

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
        <VaultBento
          statement={world ? `${world.line[0]} ${world.line[1]}` : `${vs.copy.left[0]} ${vs.copy.left[1]}`}
          sub={world ? world.story : vs.copy.intro}
          brands={brands.length}
          pieces={one ? one.pieces.length : pieces.length}
          sold={one ? one.pieces.filter((p) => p.status === "sold_out").length : sold}
          figure={(one && FIGURES[brandKey(one.name)]) || FIGURES.all}
        />

        {brands.length > 0 && (
          <section id="vault-brands" aria-label="Brands" className="scroll-mt-24 px-3 pt-3 md:px-4 md:pt-4">
            <VaultBrandGrid
              total={pieces.length}
              active={one?.name}
              brands={brands.map((b) => ({ name: b.name, n: b.pieces.length, href: vaultHref(b.name), origin: brandWorld(b.name, vs.brands)?.origin ?? "Original brand", kinds: Array.from(new Set(b.pieces.map((p) => p.category))).map((k) => k.charAt(0).toUpperCase() + k.slice(1).replace("-", " ")) }))}
            />
          </section>
        )}

        {/* The pieces, in one big rounded black panel */}
        <div className="px-3 pt-3 md:px-4 md:pt-4">
          {/* Its headlines in the same bold, tight sans as the cards above */}
          <div className={`overflow-hidden rounded-[28px] ${V.slate} text-white [&_.display]:!font-sans [&_.display]:!font-semibold [&_.display]:!normal-case [&_.display]:!tracking-[-0.035em]`}>
            <div className="container-ep pb-16 pt-4 md:pb-24">
              {pieces.length === 0 ? (
                <p className={`py-24 text-center text-[17px] ${V.iceDim}`}>The wall is empty for now. The first pieces arrive soon.</p>
              ) : (
                <>
                  {wanted && !one && <p className={`pt-8 text-[15px] ${V.iceDim}`}>Nothing from &ldquo;{wanted}&rdquo; right now. Here&apos;s the rest of the Vault.</p>}
                  <div className="pt-12 md:pt-16">
                    <VaultTriptych key={one?.name ?? "all"} pieces={featured} />
                  </div>
                  <div className="mt-14 border-t border-white/10 md:mt-20">{spot && <VaultSpotlight piece={spot} />}</div>
                  <div id="inventory" className="scroll-mt-28 border-t border-white/10 pt-12 md:pt-16">
                    <VaultInventory tiles={tiles} brand={one?.name} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
