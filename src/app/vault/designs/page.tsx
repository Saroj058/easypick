import type { Metadata } from "next";
import Link from "next/link";

import { featuredVault, vaultBrands, vaultPieces } from "@/components/home/vault";
import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/lib/format";
import { getProducts } from "@/lib/store";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "Vault designs", robots: { index: false, follow: false } };
export const revalidate = 300;

// Ten designs for the Vault, to choose from (owner, 20 Oct 2026: "make 10 designs for the vault
// home page and the vault itself"). Each shows the home page's Vault section, then the top of the
// Vault page, with the real pieces. Not linked from the site; the chosen one replaces the current.

type P = { slug: string; name: string; brand: string; price: string; img: Product["images"][number]; category: Product["category"]; hex: string; ed: string; sold: boolean };

function Img({ p, className = "", ground }: { p: P; className?: string; ground?: string }) {
  return <ProductImage image={p.img} category={p.category} colourHex={p.hex} decorative sizes="300px" ground={ground} className={className} />;
}

const Label = ({ n, name, note }: { n: number; name: string; note: string }) => (
  <div className="container-ep flex flex-wrap items-baseline gap-x-4 gap-y-1 pb-4 pt-16">
    <span className="font-mono text-[12px] text-steel-dark">Design {String(n).padStart(2, "0")}</span>
    <h2 className="text-[22px] font-semibold">{name}</h2>
    <p className="text-[14px] text-steel-dark">{note}</p>
  </div>
);
const Part = ({ children }: { children: string }) => <p className="container-ep pb-2 pt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">{children}</p>;

// 1. Gallery white: a museum wall, one piece per plinth.
function D1({ ps, brands }: { ps: P[]; brands: string[] }) {
  return (
    <>
      <Part>Home section</Part>
      <section className="bg-[#fafaf8] py-14">
        <div className="container-ep">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-steel-dark">The Vault · {ps.length} pieces</p>
          <h3 className="mt-2 text-[clamp(2.4rem,1.8rem+3vw,4.5rem)] font-light tracking-[-0.03em]">One of each.</h3>
          <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {ps.slice(0, 4).map((p) => (
              <div key={p.slug}>
                <div className="bg-white p-4 shadow-[0_1px_0_#e5e5ea]">
                  <Img p={p} ground="bg-white" />
                </div>
                <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-steel-dark">{p.brand}</p>
                <p className="text-[14px]">{p.name}</p>
              </div>
            ))}
          </div>
          <Link href="/vault" className="mt-8 inline-block border-b border-ink pb-0.5 text-[14px]">Enter the Vault</Link>
        </div>
      </section>
      <Part>Vault page</Part>
      <section className="bg-[#fafaf8] pb-14">
        <div className="container-ep border-b border-mist py-10">
          <h3 className="text-[clamp(3rem,2rem+5vw,7rem)] font-light leading-none tracking-[-0.04em]">The Vault</h3>
          <div className="mt-6 flex flex-wrap gap-5 text-[13px] text-steel-dark">{brands.map((b) => <span key={b}>{b}</span>)}</div>
        </div>
        <div className="container-ep mt-8 grid grid-cols-2 gap-6 md:grid-cols-3">
          {ps.slice(0, 6).map((p) => (
            <div key={p.slug} className="bg-white p-5">
              <Img p={p} ground="bg-white" />
              <div className="mt-3 flex justify-between text-[13px]"><span>{p.name}</span><span className="font-mono">{p.price}</span></div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// 2. Night vault: black, a thin lime line, the pieces lit from above.
function D2({ ps, brands }: { ps: P[]; brands: string[] }) {
  return (
    <>
      <Part>Home section</Part>
      <section className="bg-[#0a0a0a] py-14 text-paper">
        <div className="container-ep grid items-end gap-8 md:grid-cols-[1fr_2fr]">
          <div>
            <span className="block h-px w-16 bg-volt" />
            <h3 className="display mt-4 text-[clamp(3rem,2rem+4vw,6rem)] leading-[0.85]">The<br />Vault</h3>
            <p className="mt-4 max-w-[30ch] text-[14px] text-paper/60">Original brands. One of each. Never restocked.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {ps.slice(0, 3).map((p) => (
              <div key={p.slug} className="bg-[radial-gradient(ellipse_at_50%_0%,#3a3a3e,#111113_70%)] p-3">
                <Img p={p} ground="bg-transparent" />
                <p className="mt-2 truncate text-[12px] text-paper/70">{p.brand}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Part>Vault page</Part>
      <section className="bg-[#0a0a0a] pb-14 text-paper">
        <div className="container-ep py-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-volt">● {ps.length} pieces in the Vault</p>
          <div className="mt-6 flex flex-wrap gap-2">{brands.map((b) => <span key={b} className="rounded-full border border-paper/20 px-4 py-2 text-[13px]">{b}</span>)}</div>
        </div>
        <div className="container-ep grid grid-cols-2 gap-px bg-paper/10 md:grid-cols-4">
          {ps.slice(0, 8).map((p) => (
            <div key={p.slug} className="bg-[#0a0a0a] p-4">
              <Img p={p} ground="bg-[#151517]" />
              <p className="mt-3 text-[13px]">{p.name}</p>
              <p className="font-mono text-[12px] text-paper/60">{p.price}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// 3. Archive index: a numbered catalogue, like a collector's list.
function D3({ ps }: { ps: P[] }) {
  return (
    <>
      <Part>Home section</Part>
      <section className="py-14">
        <div className="container-ep">
          <div className="flex items-end justify-between border-b-2 border-ink pb-3">
            <h3 className="display text-[clamp(2.4rem,1.8rem+3vw,4.5rem)] leading-none">Vault archive</h3>
            <span className="font-mono text-[12px]">{ps.length} entries</span>
          </div>
          <ol>
            {ps.slice(0, 5).map((p, i) => (
              <li key={p.slug} className="grid grid-cols-[40px_56px_1fr_auto] items-center gap-4 border-b border-mist py-3">
                <span className="font-mono text-[12px] text-steel-dark">{String(i + 1).padStart(3, "0")}</span>
                <Img p={p} className="!aspect-square w-14" />
                <span><span className="block text-[11px] uppercase tracking-[0.14em] text-steel-dark">{p.brand}</span>{p.name}</span>
                <span className="font-mono text-[13px]">{p.price}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <Part>Vault page</Part>
      <section className="pb-14">
        <div className="container-ep grid gap-8 md:grid-cols-[240px_1fr]">
          <aside className="font-mono text-[12px] leading-7">
            <p className="text-steel-dark">Index</p>
            {ps.slice(0, 10).map((p, i) => <p key={p.slug}>{String(i + 1).padStart(3, "0")} · {p.brand}</p>)}
          </aside>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {ps.slice(0, 6).map((p, i) => (
              <div key={p.slug} className="border border-ink p-3">
                <p className="font-mono text-[11px]">No. {String(i + 1).padStart(3, "0")}</p>
                <Img p={p} className="mt-2" />
                <p className="mt-2 text-[13px]">{p.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// 4. Spotlight: one piece huge, the rest as a strip.
function D4({ ps }: { ps: P[] }) {
  const [a, ...rest] = ps;
  return (
    <>
      <Part>Home section</Part>
      <section className="bg-[#ece9e2] py-14">
        <div className="container-ep grid items-center gap-8 md:grid-cols-2">
          <Img p={a} ground="bg-transparent" className="mx-auto w-full max-w-[420px]" />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-steel-dark">This week in the Vault</p>
            <h3 className="display mt-2 text-[clamp(2.4rem,1.6rem+3vw,4rem)] leading-[0.9]">{a.brand}<br />{a.name}</h3>
            <p className="mt-3 font-mono">{a.price} · {a.ed || "one of one"}</p>
            <div className="mt-6 flex gap-2">{rest.slice(0, 4).map((p) => <Img key={p.slug} p={p} className="w-16" />)}</div>
          </div>
        </div>
      </section>
      <Part>Vault page</Part>
      <section className="pb-14">
        <div className="relative bg-[#ece9e2]">
          <div className="container-ep grid min-h-[420px] items-end gap-6 py-10 md:grid-cols-[1fr_1fr]">
            <h3 className="display text-[clamp(3rem,2rem+5vw,7rem)] leading-[0.85]">The<br />Vault</h3>
            <Img p={rest[0] ?? a} ground="bg-transparent" className="w-full max-w-[380px] justify-self-end" />
          </div>
        </div>
        <div className="container-ep mt-6 flex gap-4 overflow-x-auto pb-2">
          {ps.slice(0, 8).map((p) => <div key={p.slug} className="w-40 shrink-0"><Img p={p} /><p className="mt-2 truncate text-[12px]">{p.name}</p></div>)}
        </div>
      </section>
    </>
  );
}

// 5. Bento: mixed tile sizes, like a lookbook spread.
function D5({ ps }: { ps: P[] }) {
  return (
    <>
      <Part>Home section</Part>
      <section className="py-14">
        <div className="container-ep grid auto-rows-[160px] grid-cols-2 gap-3 md:auto-rows-[200px] md:grid-cols-4">
          <div className="col-span-2 row-span-2 flex flex-col justify-end rounded-[24px] bg-ink p-6 text-paper">
            <h3 className="display text-[clamp(2.4rem,1.8rem+3vw,4.5rem)] leading-[0.85]">The Vault</h3>
            <p className="mt-2 text-[14px] text-paper/60">{ps.length} original pieces · one of each</p>
          </div>
          {ps.slice(0, 4).map((p, i) => (
            <div key={p.slug} className={`overflow-hidden rounded-[24px] bg-photo ${i === 0 ? "row-span-2" : ""}`}><Img p={p} className="h-full" /></div>
          ))}
        </div>
      </section>
      <Part>Vault page</Part>
      <section className="pb-14">
        <div className="container-ep grid auto-rows-[180px] grid-cols-2 gap-3 md:grid-cols-4">
          {ps.slice(0, 9).map((p, i) => (
            <div key={p.slug} className={`relative overflow-hidden rounded-[24px] bg-photo ${i % 5 === 0 ? "col-span-2 row-span-2" : ""}`}>
              <Img p={p} className="h-full" />
              <span className="absolute bottom-3 left-3 rounded-full bg-paper px-3 py-1 text-[12px]">{p.brand} · {p.price}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// 6. Ticket stubs: each piece as a numbered tag, the store's hang tag style.
function D6({ ps }: { ps: P[] }) {
  const Tag = ({ p, i }: { p: P; i: number }) => (
    <div className="relative rounded-[6px] border border-ink bg-paper p-3 before:absolute before:-top-2 before:left-1/2 before:h-4 before:w-4 before:-translate-x-1/2 before:rounded-full before:border before:border-ink before:bg-[#f2efe6]">
      <Img p={p} />
      <div className="mt-2 border-t border-dashed border-ink pt-2 font-mono text-[11px]">
        <div className="flex justify-between"><span>{p.brand}</span><span>#{String(i + 1).padStart(2, "0")}</span></div>
        <div className="mt-1 flex justify-between font-semibold"><span className="truncate">{p.name}</span><span>{p.price}</span></div>
      </div>
    </div>
  );
  return (
    <>
      <Part>Home section</Part>
      <section className="bg-[#f2efe6] py-14">
        <div className="container-ep">
          <h3 className="display text-[clamp(2.4rem,1.8rem+3vw,4.5rem)] leading-none">Tagged in the Vault</h3>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">{ps.slice(0, 4).map((p, i) => <Tag key={p.slug} p={p} i={i} />)}</div>
        </div>
      </section>
      <Part>Vault page</Part>
      <section className="bg-[#f2efe6] pb-14">
        <div className="container-ep grid grid-cols-2 gap-4 pt-4 md:grid-cols-4">{ps.slice(0, 8).map((p, i) => <Tag key={p.slug} p={p} i={i} />)}</div>
      </section>
    </>
  );
}

// 7. Split screen: words fixed on the left, pieces scroll on the right.
function D7({ ps, brands }: { ps: P[]; brands: string[] }) {
  return (
    <>
      <Part>Home section</Part>
      <section className="py-14">
        <div className="container-ep grid gap-6 md:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col justify-between rounded-[24px] bg-[#1d2a44] p-8 text-paper">
            <h3 className="display text-[clamp(2.4rem,1.8rem+3vw,4.5rem)] leading-[0.85]">The Vault</h3>
            <p className="mt-10 text-[14px] text-paper/70">{brands.slice(0, 4).join(" · ")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">{ps.slice(0, 4).map((p) => <div key={p.slug} className="rounded-[18px] bg-photo p-2"><Img p={p} /></div>)}</div>
        </div>
      </section>
      <Part>Vault page</Part>
      <section className="pb-14">
        <div className="container-ep grid gap-8 md:grid-cols-[320px_1fr]">
          <div className="rounded-[24px] bg-[#1d2a44] p-8 text-paper md:sticky md:top-24 md:h-fit">
            <h3 className="display text-[56px] leading-[0.85]">The Vault</h3>
            <ul className="mt-6 space-y-2 text-[14px]">{brands.map((b) => <li key={b} className="border-b border-paper/15 pb-2">{b}</li>)}</ul>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{ps.slice(0, 9).map((p) => <div key={p.slug}><Img p={p} className="rounded-[18px]" /><p className="mt-2 text-[13px]">{p.name}</p><p className="font-mono text-[12px] text-steel-dark">{p.price}</p></div>)}</div>
        </div>
      </section>
    </>
  );
}

// 8. Brand shelves: one row per brand, the brand's name huge behind it.
function D8({ ps, brands }: { ps: P[]; brands: string[] }) {
  return (
    <>
      <Part>Home section</Part>
      <section className="overflow-hidden py-14">
        <div className="container-ep">
          <h3 className="display text-[clamp(2.4rem,1.8rem+3vw,4.5rem)] leading-none">The Vault</h3>
          {brands.slice(0, 2).map((b) => (
            <div key={b} className="relative mt-6">
              <p aria-hidden className="display pointer-events-none absolute -top-6 left-0 text-[120px] leading-none text-ink/[0.05]">{b}</p>
              <div className="relative flex gap-3">{ps.filter((p) => p.brand === b).slice(0, 4).map((p) => <div key={p.slug} className="w-36 shrink-0"><Img p={p} /></div>)}</div>
            </div>
          ))}
        </div>
      </section>
      <Part>Vault page</Part>
      <section className="overflow-hidden pb-14">
        <div className="container-ep space-y-10">
          {brands.slice(0, 4).map((b) => (
            <div key={b}>
              <div className="flex items-baseline justify-between border-b border-ink pb-2"><p className="display text-[40px] leading-none">{b}</p><span className="font-mono text-[12px]">{ps.filter((p) => p.brand === b).length}</span></div>
              <div className="mt-4 flex gap-3 overflow-x-auto">{ps.filter((p) => p.brand === b).slice(0, 6).map((p) => <div key={p.slug} className="w-40 shrink-0"><Img p={p} /><p className="mt-2 truncate text-[12px]">{p.name} · {p.price}</p></div>)}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// 9. Glass case: frosted glass cards on a soft colour field.
function D9({ ps }: { ps: P[] }) {
  const field = "bg-[radial-gradient(circle_at_20%_20%,#c9d6e8,transparent_50%),radial-gradient(circle_at_80%_70%,#e8d9c9,transparent_50%),#eef0f2]";
  return (
    <>
      <Part>Home section</Part>
      <section className={`${field} py-14`}>
        <div className="container-ep">
          <h3 className="text-center text-[clamp(2.4rem,1.8rem+3vw,4.5rem)] font-semibold tracking-[-0.03em]">The Vault.</h3>
          <p className="text-center text-[15px] text-steel-dark">Original. One of each.</p>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">{ps.slice(0, 4).map((p) => <div key={p.slug} className="rounded-[28px] bg-white/50 p-4 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.2)] ring-1 ring-white/60 backdrop-blur-xl"><Img p={p} ground="bg-transparent" /><p className="mt-2 text-center text-[13px] font-semibold">{p.name}</p></div>)}</div>
        </div>
      </section>
      <Part>Vault page</Part>
      <section className={`${field} pb-14`}>
        <div className="container-ep grid grid-cols-2 gap-4 pt-8 md:grid-cols-4">{ps.slice(0, 8).map((p) => <div key={p.slug} className="rounded-[28px] bg-white/50 p-4 ring-1 ring-white/60 backdrop-blur-xl"><Img p={p} ground="bg-transparent" /><p className="mt-2 text-[13px] font-semibold">{p.name}</p><p className="font-mono text-[12px] text-steel-dark">{p.brand} · {p.price}</p></div>)}</div>
      </section>
    </>
  );
}

// 10. Magazine cover: one big headline over a piece, issue number, cover lines.
function D10({ ps }: { ps: P[] }) {
  const [a, b, c] = ps;
  return (
    <>
      <Part>Home section</Part>
      <section className="bg-[#c2410c] py-14 text-paper">
        <div className="container-ep relative grid min-h-[420px] items-center md:grid-cols-2">
          <h3 className="display relative z-10 text-[clamp(4rem,2rem+8vw,10rem)] leading-[0.8]">VAULT</h3>
          <Img p={a} ground="bg-transparent" className="w-full max-w-[380px] justify-self-center" />
          <div className="mt-6 space-y-2 font-mono text-[12px] uppercase tracking-[0.12em] md:absolute md:bottom-0 md:left-0">
            <p>Issue {String(ps.length).padStart(2, "0")}</p>
            <p>{a.brand}: {a.name}</p>
            {b && <p>{b.brand}: {b.name}</p>}
            {c && <p>{c.brand}: {c.name}</p>}
          </div>
        </div>
      </section>
      <Part>Vault page</Part>
      <section className="pb-14">
        <div className="bg-[#c2410c] py-8 text-paper"><div className="container-ep flex items-end justify-between"><h3 className="display text-[clamp(3rem,2rem+5vw,7rem)] leading-[0.8]">VAULT</h3><p className="font-mono text-[12px]">Issue {String(ps.length).padStart(2, "0")}</p></div></div>
        <div className="container-ep mt-8 columns-2 gap-4 md:columns-4">{ps.slice(0, 8).map((p, i) => <div key={p.slug} className="mb-4 break-inside-avoid"><Img p={p} className={i % 3 === 0 ? "!aspect-[3/4]" : ""} /><p className="mt-2 text-[12px] uppercase tracking-[0.12em] text-steel-dark">{p.brand}</p><p className="text-[14px]">{p.name}</p></div>)}</div>
      </section>
    </>
  );
}

const DESIGNS = [
  { name: "Gallery white", note: "A quiet museum wall; one piece per plinth.", C: D1 },
  { name: "Night vault", note: "Black, one lime line, pieces lit from above.", C: D2 },
  { name: "Archive index", note: "A numbered collector's catalogue.", C: D3 },
  { name: "Spotlight", note: "One piece huge, the rest beside it.", C: D4 },
  { name: "Bento", note: "Mixed tiles, like a lookbook spread.", C: D5 },
  { name: "Hang tags", note: "Each piece as the store's own numbered tag.", C: D6 },
  { name: "Split screen", note: "Words held still on the left, pieces on the right.", C: D7 },
  { name: "Brand shelves", note: "A row per brand, its name huge behind it.", C: D8 },
  { name: "Glass case", note: "Frosted glass cards on a soft colour field.", C: D9 },
  { name: "Magazine cover", note: "A bold cover with an issue number and cover lines.", C: D10 },
];

export default async function VaultDesigns() {
  const pieces = vaultPieces(await getProducts());
  const picked = featuredVault(pieces, 12).concat(pieces).filter((p, i, a) => a.indexOf(p) === i);
  const ps: P[] = picked.map((p) => ({
    slug: p.slug,
    name: p.name,
    brand: p.brand ?? "Original",
    price: formatPrice(p.salePrice ?? p.price),
    img: p.images[0] ?? { src: null, alt: p.name, kind: "front" },
    category: p.category,
    hex: p.colours[0]?.hex ?? "#2b2b2e",
    ed: p.edition ? `${p.edition.no} of ${p.edition.of}` : "",
    sold: p.status === "sold_out",
  }));
  const brands = vaultBrands(pieces).map((b) => b.name);
  if (!ps.length) return <p className="container-ep py-24">The Vault has no pieces yet.</p>;
  return (
    <div className="pb-24">
      <div className="container-ep pt-10">
        <h1 className="display text-[clamp(2.4rem,1.8rem+3vw,4rem)] leading-none">Ten Vault designs</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] text-steel-dark">Each shows the home page&apos;s Vault section, then the top of the Vault page, with the real pieces. Pick a number and it replaces the current design.</p>
        <nav className="mt-4 flex flex-wrap gap-2">{DESIGNS.map((d, i) => <a key={d.name} href={`#d${i + 1}`} className="rounded-full border border-mist px-3 py-1.5 text-[13px] hover:border-ink">{i + 1}. {d.name}</a>)}</nav>
      </div>
      {DESIGNS.map(({ name, note, C }, i) => (
        <div key={name} id={`d${i + 1}`} className="scroll-mt-20 border-t border-mist">
          <Label n={i + 1} name={name} note={note} />
          <C ps={ps} brands={brands} />
        </div>
      ))}
    </div>
  );
}
