import type { Metadata } from "next";

import { AlertSignup } from "@/components/alert-signup";
import { featuredVault, toTile, vaultBrands, vaultHref, vaultPieces } from "@/components/home/vault";
import { brandKey, brandWorld, MONO, themeVars, two, V } from "@/components/vault/look";
import { ScrollToOpen } from "@/components/vault/scroll-to-open";
import { VaultBrands } from "@/components/vault/vault-brands";
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
        side={["Shop the Vault", "Hear it first"]}
        figure={(one && FIGURES[brandKey(one.name)]) || FIGURES.all}
      />

      {/* The black band: the brand's story on its page, and the brands as cards (owner, 25 Oct 2026: no list of facts) */}
      <div className={`${V.slate} text-white`}>
        <div className="container-ep py-8 md:py-10">
          {world && (
            <p className={`mb-8 max-w-[62ch] text-[15px] leading-relaxed ${V.iceDim}`}>
              <span className="text-white">{one?.name}.</span> {world.story}
            </p>
          )}
          {brands.length > 0 && (
            <ScrollToOpen>
              <VaultBrands worlds={vs.brands} cold={{ ...MONO, slate: "#ecebe7" }} total={pieces.length} active={one?.name} brands={brands.map((b) => ({ name: b.name, n: b.pieces.length, href: vaultHref(b.name) }))} />
            </ScrollToOpen>
          )}
        </div>
      </div>

      {/* The panel, black */}
      <div className="relative mx-auto mt-10 max-w-[1320px] md:mt-14 md:px-6">
        <div className={`relative isolate overflow-hidden ${V.slate} px-4 pb-14 pt-8 text-white md:px-12 md:pb-20 md:pt-12`}>
          <div className={`flex justify-between gap-4 ${V.mono} ${V.iceDim}`}>
            <span>[ Active: {one ? one.name : "all brands"} ]</span>
            <span className="hidden text-right sm:inline">[ New pieces · a few times a month ]</span>
          </div>

          {pieces.length === 0 ? (
            <p className={`py-24 text-center text-[17px] ${V.iceDim}`}>The wall is empty for now. Join the list below and we&apos;ll message you when the first pieces arrive.</p>
          ) : (
            <>
              {wanted && !one && <p className={`mt-6 text-[15px] ${V.iceDim}`}>Nothing from &ldquo;{wanted}&rdquo; right now. Here&apos;s the rest of the Vault.</p>}
              <div className="mt-8 md:mt-10">
                <VaultTriptych
                  key={one?.name ?? "all"}
                  pieces={featured}
                  left={world ? world.line : vs.copy.left}
                  right={world ? ["One of each.", "Never restocked."] : vs.copy.right}
                />
              </div>
              {spot && <VaultSpotlight piece={spot} />}
              <div id="inventory" className="scroll-mt-28">
                <VaultInventory tiles={tiles} brand={one?.name} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* The close: the Vault list, and the small print */}
      <section aria-labelledby="vault-list" className="container-ep relative grid gap-8 pb-16 pt-16 md:grid-cols-2 md:items-end md:gap-12 md:pb-24 md:pt-24">
        <div>
          <p className={`${V.mono} ${V.ink}`}>[ The Vault list ]</p>
          <h2 id="vault-list" className={`display mt-2 text-[clamp(2.4rem,1.8rem+2.4vw,4.4rem)] leading-[0.88] ${V.deep}`}>
            {vs.copy.listTitle}
          </h2>
        </div>
        <div>
          {/* The owner's note sits once, under the field (it used to show twice). */}
          <AlertSignup source="vault" note={vs.copy.listNote || "One message when a new piece lands. Stop anytime."} done="You're in. We'll message {to} when a new piece lands." />
        </div>
        <p className={`text-[12.5px] leading-relaxed md:col-span-2 ${V.ink}`}>Brand names describe the pieces. Easypick is an independent store, not an official seller of these brands.</p>
      </section>
    </div>
  );
}
