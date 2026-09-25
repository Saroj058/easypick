"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { hasFit, matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import { searchProducts } from "@/lib/search";
import { categoryLabels } from "@/lib/site";
import type { Product } from "@/lib/types";
import { useFitProfile } from "./fit-finder";
import { ProductImage } from "./product-image";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./ui/sheet";

const RECENT_KEY = "ep-search-recent-v1";
const UNDER = 1500;

let catalogue: Promise<Product[]> | null = null;
function loadCatalogue() {
  catalogue ??= fetch("/api/products")
    .then((r) => (r.ok ? (r.json() as Promise<Product[]>) : []))
    .catch(() => {
      catalogue = null; // try again next time
      return [];
    });
  return catalogue;
}

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(0, 5) : [];
  } catch {
    return [];
  }
}
function rememberSearch(q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([t, ...readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 5)));
  } catch {
    // storage blocked
  }
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex min-h-10 items-center rounded-full border px-4 text-[14px] ${on ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
    >
      {children}
    </button>
  );
}

/** Magnifier in the header: search as you type, forgiving of spelling. Press "/" anywhere to open. */
export function SearchButton() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [inMySize, setInMySize] = useState(false);
  const [under, setUnder] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const profile = useFitProfile();
  const hasProfile = hasFit(profile);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      loadCatalogue().then(setProducts);
      setRecent(readRecent());
    }
  }
  // Opened with "/": load too.
  useEffect(() => {
    if (open && products === null) loadCatalogue().then(setProducts);
  }, [open, products]);

  const results = useMemo(() => {
    let list = searchProducts(products ?? [], q);
    if (under) list = list.filter((p) => (p.salePrice ?? p.price) <= UNDER);
    if (inMySize && hasProfile)
      list = list.filter((p) => {
        const m = matchSize(p.category, p.measurements, profile);
        return p.status === "live" && (m ? p.variants.some((v) => v.size === m.size && v.stock > 0) : p.variants.some((v) => v.size === "ONE" && v.stock > 0));
      });
    return list;
  }, [products, q, under, inMySize, hasProfile, profile]);

  const filtering = q.trim() !== "" || under || inMySize;
  const close = () => {
    rememberSearch(q);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button type="button" className="flex h-10 w-10 items-center justify-center" aria-label="Search" aria-keyshortcuts="/">
          <Search className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent
        side="top"
        hideClose
        className="max-h-[100dvh] overflow-y-auto border-mist bg-paper px-4 pb-8 pt-[calc(16px+env(safe-area-inset-top))]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="mx-auto max-w-2xl">
          <SheetTitle className="sr-only">Search</SheetTitle>
          <SheetDescription className="sr-only">Results update as you type.</SheetDescription>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (results[0]) {
                close();
                router.push(`/product/${results[0].slug}`);
              }
            }}
            className="flex items-center gap-2 border-b-2 border-ink pb-2"
          >
            <Search className="h-6 w-6 shrink-0" strokeWidth={1.8} aria-hidden />
            <label htmlFor="site-search" className="sr-only">
              Search Easypick
            </label>
            <input
              ref={inputRef}
              id="site-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hoodie, black tee, cargo…"
              autoComplete="off"
              enterKeyHint="search"
              className="h-12 min-w-0 flex-1 bg-transparent text-[22px] outline-none placeholder:text-steel-dark md:text-[28px] [&::-webkit-search-cancel-button]:appearance-none"
            />
            <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center" aria-label="Close search">
              <X className="h-6 w-6" aria-hidden />
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {hasProfile && (
              <Chip on={inMySize} onClick={() => setInMySize((v) => !v)}>
                In my size
              </Chip>
            )}
            <Chip on={under} onClick={() => setUnder((v) => !v)}>
              Under {formatPrice(UNDER)}
            </Chip>
          </div>

          {!filtering && (
            <div className="mt-6">
              {recent.length > 0 && (
                <>
                  <p className="text-[13px] text-steel-dark">Recent</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <li key={r}>
                        <button type="button" onClick={() => setQ(r)} className="min-h-10 rounded-full bg-photo px-4 text-[14px] hover:bg-mist">
                          {r}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-5 text-[13px] text-steel-dark">Browse</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {Object.entries(categoryLabels).map(([slug, label]) => (
                  <li key={slug}>
                    <Link href={`/shop?category=${slug}`} onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center rounded-full border border-mist px-4 text-[14px] hover:border-ink">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {filtering && (
            <div className="mt-6">
              <p role="status" className="text-[13px] text-steel-dark">
                {products === null ? "Loading…" : results.length === 0 ? `Nothing for “${q.trim() || "that"}”.` : `${results.length} ${results.length === 1 ? "piece" : "pieces"}`}
              </p>
              {products !== null && results.length === 0 && (
                <p className="mt-2 text-[15px]">
                  Try a simpler word, like <button type="button" className="underline" onClick={() => setQ("hoodie")}>hoodie</button> or{" "}
                  <button type="button" className="underline" onClick={() => setQ("black")}>black</button>, or{" "}
                  <Link href="/shop" onClick={() => setOpen(false)} className="underline">
                    see everything
                  </Link>
                  .
                </p>
              )}
              <ul className="mt-3 divide-y divide-mist">
                {results.slice(0, 12).map((p) => (
                  <li key={p.slug}>
                    <Link href={`/product/${p.slug}`} onClick={close} className="flex items-center gap-4 py-3 hover:bg-photo">
                      <div className="w-14 shrink-0">
                        <ProductImage image={p.images[0]} category={p.category} colourHex={p.colours[0]?.hex ?? "#ccc"} decorative sizes="56px" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="truncate text-[13px] text-steel-dark">
                          {p.status === "sold_out" ? "Sold out · " : p.status === "scheduled" ? "Coming soon · " : ""}
                          {p.colours.map((c) => c.name).join(", ")}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-[14px]">{formatPrice(p.salePrice ?? p.price)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
