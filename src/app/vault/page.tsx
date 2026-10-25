import type { Metadata } from "next";

import { featuredVault, toTile, vaultBrands, vaultHref, vaultPieces } from "@/components/home/vault";
import PerspectiveTunnelHero from "@/components/ui/perspective-tunnel-hero";
import { brandWorld } from "@/components/vault/look";
import { FactsStrip, Grain, SectionIndex } from "@/components/vault/lux/ambience";
import { BrandIndex } from "@/components/vault/lux/brand-index";
import { BrandOpening } from "@/components/vault/lux/brand-opening";
import { TryInStore, VaultList } from "@/components/vault/lux/closing";
import { VaultCollection } from "@/components/vault/lux/collection";
import { VaultGallery } from "@/components/vault/lux/gallery";
import { HowWeCheck } from "@/components/vault/lux/how-we-check";
import { VaultManifesto } from "@/components/vault/lux/manifesto";
import { LuxSpotlight } from "@/components/vault/lux/spotlight";
import { L, luxVars } from "@/components/vault/lux/tokens";
import { formatPrice } from "@/lib/format";
import { vaultSetting } from "@/lib/settings/vault";
import { site, walletList } from "@/lib/site";
import { getProducts } from "@/lib/store";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "The Vault",
  description: "Original brands at Easypick, Kathmandu. One of each piece, never restocked.",
  alternates: { canonical: "/vault" },
};

// The Vault, luxury (owner, 25 Oct 2026: "make the vault a better motion graphic page… revamp it
// full page like a luxury website"; it opens on the perspective tunnel the owner chose). One dark
// ground, ivory serif type, hairlines. Top to bottom: the tunnel of pieces (or, on a brand's page,
// that brand's own opening in its own colour), the statement and real numbers, the brands as an
// index, a pinned gallery of the featured pieces, one piece in the spotlight, everything with
// filters, how we check, trying on in store, and the Vault list. The parts are in components/vault/lux/.
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
  // The spotlight: a different piece from the gallery's first, one that can be bought.
  const spot = featured.slice(1).find((t) => !t.sold) ?? featured.find((t) => !t.sold) ?? featured[0];
  const tiles = list.map((p, i) => toTile(p, i));
  // The tunnel flies through up to nine pieces, buyable first.
  const tunnel = [...featured, ...featuredVault(list, 9).map((p, i) => toTile(p, i))].filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i).slice(0, 9);
  const world = brandWorld(one?.name, vs.brands);
  const facts = [
    "Original brands",
    "One of each",
    site.store.address ? "Try it on in our store" : "Try-on in store · opening soon",
    `Pay with ${walletList()}`,
    `Free delivery over ${formatPrice(site.delivery.freeAbove)}`,
  ];
  const sections = [
    { id: "vault-statement", label: "The Vault" },
    ...(one ? [] : [{ id: "vault-brands", label: "Brands" }]),
    ...(featured.length > 1 ? [{ id: "vault-gallery", label: "Featured" }] : []),
    { id: "inventory", label: "Collection" },
    { id: "vault-check", label: "How we check" },
    { id: "vault-list-section", label: "The list" },
  ];

  return (
    <div style={luxVars(world?.theme)} className={`vault relative isolate overflow-x-clip ${L.ground} ${L.ivory} pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0`}>
      <Grain />
      <SectionIndex sections={pieces.length ? sections : []} />

      {/* The opening */}
      {one ? (
        <BrandOpening name={one.name} world={world} count={one.pieces.length} lead={featured.find((t) => !t.sold) ?? featured[0]} />
      ) : pieces.length > 0 ? (
        <PerspectiveTunnelHero pieces={tunnel} eyebrow={`Easypick · ${brands.length} brands · ${pieces.length} pieces`} title={["The", "Vault"]} line="Original brands. One of each. Never restocked." />
      ) : (
        <section className={`${L.wrap} pb-16 pt-36`}>
          <p className={`${L.label} ${L.dim}`}>Easypick</p>
          <h1 className={`${L.serif} mt-4 text-[clamp(3.4rem,1.8rem+7vw,9rem)] leading-[0.9]`}>The Vault</h1>
        </section>
      )}

      {/* The statement, and the real numbers */}
      <div id="vault-statement" className="scroll-mt-24">
        <VaultManifesto
          intro={vs.copy.intro}
          numbers={
            one
              ? [{ label: one.pieces.length === 1 ? "Piece" : "Pieces", value: one.pieces.length }, { label: "Sold", value: one.pieces.filter((p) => p.status === "sold_out").length }]
              : [{ label: "Brands", value: brands.length }, { label: "Pieces", value: pieces.length }, { label: "Sold", value: sold }]
          }
        />
      </div>

      {pieces.length === 0 ? (
        <p className={`${L.wrap} pb-24 text-[17px] ${L.dim}`}>The wall is empty for now. Join the list below and we&apos;ll message you when the first pieces arrive.</p>
      ) : (
        <>
          <FactsStrip facts={facts} />
          {wanted && !one && <p className={`${L.wrap} pt-10 text-[15px] ${L.dim}`}>Nothing from &ldquo;{wanted}&rdquo; right now. Here&apos;s the rest of the Vault.</p>}

          {!one && (
            <section id="vault-brands" aria-label="Brands" className={`scroll-mt-24 ${L.section} ${L.wrap}`}>
              <p className={`${L.label} ${L.dim} mb-8`}>[ 03 — The brands ]</p>
              <BrandIndex
                total={pieces.length}
                brands={brands.map((b) => ({ name: b.name, n: b.pieces.length, href: vaultHref(b.name), origin: brandWorld(b.name, vs.brands)?.origin ?? "", pieces: featuredVault(b.pieces, 3).map((p, i) => toTile(p, i)) }))}
              />
            </section>
          )}

          {featured.length > 1 && (
            <div id="vault-gallery" className="scroll-mt-24">
              <VaultGallery key={one?.name ?? "all"} pieces={featured} title={world ? world.line : vs.copy.left} />
            </div>
          )}

          {spot && <LuxSpotlight piece={spot} />}

          <VaultCollection tiles={tiles} brand={one?.name} />
        </>
      )}

      <div id="vault-check" className="scroll-mt-24">
        <HowWeCheck />
      </div>
      <TryInStore />
      <div id="vault-list-section" className="scroll-mt-24">
        <VaultList title={vs.copy.listTitle} note={vs.copy.listNote} />
      </div>
    </div>
  );
}
