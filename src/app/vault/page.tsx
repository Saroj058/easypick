import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { featuredVault, toTile, vaultBrands, vaultHref, vaultPieces } from "@/components/home/vault";
import { brandWorld, COLD, themeVars, two, V } from "@/components/vault/look";
import { ScrollToOpen } from "@/components/vault/scroll-to-open";
import { VaultBrands } from "@/components/vault/vault-brands";
import { VaultWatermark } from "@/components/vault/vault-watermark";
import { VaultInventory } from "@/components/vault/vault-inventory";
import { VaultSpotlight } from "@/components/vault/vault-spotlight";
import { VaultTriptych } from "@/components/vault/vault-triptych";
import { formatPrice } from "@/lib/format";
import { site, walletList } from "@/lib/site";
import { getProducts } from "@/lib/store";

export const revalidate = 60;

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
  const pieces = vaultPieces(await getProducts());
  const brands = vaultBrands(pieces);
  const one = wanted ? brands.find((b) => b.name.toLowerCase() === wanted.toLowerCase()) : undefined;
  const list = one ? one.pieces : pieces;
  const sold = pieces.filter((p) => p.status === "sold_out").length;
  const featured = featuredVault(list, 5).map((p, i) => toTile(p, i));
  // The spotlight: a different piece from the one the triptych opens on, one that can be bought.
  const spot = featured.slice(1).find((t) => !t.sold) ?? featured.find((t) => !t.sold) ?? featured[0];
  const tiles = list.map((p, i) => toTile(p, i));
  // Each brand wears its own colours and tells its own story; "All" is the Vault's cold blue.
  const world = brandWorld(one?.name);
  const facts = [
    "Original brands",
    "One of each",
    site.store.address ? "Try it on in our store" : "Try-on in store · opening soon",
    `Pay with ${walletList()}`,
    `Free delivery over ${formatPrice(site.delivery.freeAbove)}`,
  ];

  return (
    <div style={themeVars(world?.theme ?? COLD)} className={`vault relative isolate min-h-[80svh] overflow-x-clip ${V.frost} pb-[calc(56px+env(safe-area-inset-bottom))] transition-colors duration-500 md:pb-0`}>
      {/* The brand's name, faint and huge, behind everything */}
      <VaultWatermark text={one?.name ?? "The Vault"} rows={14} />
      {/* The opening, on frost */}
      <div className="container-ep relative pt-8 md:pt-12">
        <div className={`flex items-center justify-between gap-4 ${V.mono} ${V.ink}`}>
          {one ? (
            <Link href={vaultHref()} className="inline-flex min-h-11 items-center gap-2 hover:underline">
              <span aria-hidden>←</span> [ The Vault ]
            </Link>
          ) : (
            <span>[ Easypick · The Vault ]</span>
          )}
          <span className="hidden whitespace-nowrap sm:inline">
            [ {two(brands.length)} brands · {two(pieces.length)} pieces{sold ? ` · ${two(sold)} sold` : ""} ]
          </span>
        </div>
        {/* The brands first: one card each, in its own colours */}
        {brands.length > 0 && (
          <div className="mt-6">
            <ScrollToOpen>
              <VaultBrands total={pieces.length} active={one?.name} brands={brands.map((b) => ({ name: b.name, n: b.pieces.length, href: vaultHref(b.name) }))} />
            </ScrollToOpen>
          </div>
        )}
        <div className="mt-10 grid gap-6 md:mt-14 md:grid-cols-[1fr_minmax(0,34ch)] md:items-end">
          <div>
            {world && <p className={`${V.mono} ${V.ink}`}>[ {world.origin} ]</p>}
            <h1 className={`display mt-2 text-[clamp(3rem,1.6rem+6vw,8rem)] leading-[0.84] ${V.deep}`}>{one ? one.name : "The Vault"}</h1>
            {world && (
              <p className={`display mt-3 text-[clamp(1.6rem,1.1rem+1.8vw,2.6rem)] leading-[0.95] ${V.deep}`}>
                {world.line[0]} <span className="opacity-70">{world.line[1]}</span>
              </p>
            )}
          </div>
          <div className={`text-left md:text-right`}>
            {world ? (
              <p className={`text-[15px] leading-relaxed ${V.ink}`}>{world.story}</p>
            ) : (
              <p className={`${V.mono} leading-[1.7] ${V.ink}`}>
                {one ? `${one.pieces.length} ${one.pieces.length === 1 ? "piece" : "pieces"} from ${one.name}. One of each.` : "Original brands, one of each. Checked by hand, never restocked, gone when it's gone."}
              </p>
            )}
            {one && (
              <p className={`mt-3 ${V.mono} ${V.ink}`}>
                [ {two(one.pieces.length)} {one.pieces.length === 1 ? "piece" : "pieces"} here · one of each ]
              </p>
            )}
          </div>
        </div>
        <ul aria-label="Good to know" className={`no-scrollbar -mx-4 mt-8 flex gap-x-6 overflow-x-auto whitespace-nowrap border-y border-[var(--v-ink)]/15 px-4 py-3 ${V.mono} ${V.ink} md:mx-0 md:flex-wrap md:px-0`}>
          {facts.map((f) => (
            <li key={f}>[ {f} ]</li>
          ))}
        </ul>
      </div>

      {/* The panel, slate */}
      <div className="relative mx-auto mt-10 max-w-[1320px] md:mt-14 md:px-6">
        <div className={`relative isolate overflow-hidden ${V.slate} px-4 pb-14 pt-8 text-white md:px-12 md:pb-20 md:pt-12`}>
          <VaultWatermark text={one?.name ?? "The Vault"} tone="light" rows={16} />
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
                  left={world ? world.line : ["Not for many.", "For the few."]}
                  right={world ? ["One of each.", "Never restocked."] : ["Checked by hand.", "Never restocked."]}
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
            Hear it first.
          </h2>
          <p className={`mt-3 max-w-[40ch] text-[15px] ${V.ink}`}>One message when a new piece lands. Stop anytime.</p>
        </div>
        <div>
          <AlertSignup source="vault" note="One message when a new piece lands. Stop anytime." done="You're in. We'll message {to} when a new piece lands." />
        </div>
        <p className={`text-[12.5px] leading-relaxed md:col-span-2 ${V.ink}`}>Brand names describe the pieces. Easypick is an independent store, not an official seller of these brands.</p>
      </section>
    </div>
  );
}
