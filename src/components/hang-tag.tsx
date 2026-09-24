import { formatPrice } from "@/lib/format";
import type { Product, Size } from "@/lib/types";

/** Deterministic barcode from a string: each character sets a bar width of 1–3. */
export function Barcode({ value, className = "" }: { value: string; className?: string }) {
  let x = 0;
  const bars = Array.from(value).flatMap((ch, i) => {
    const code = ch.charCodeAt(0);
    const w = (code % 3) + 1;
    const gap = ((code >> 2) % 2) + 1;
    const bar = { x, w, i };
    x += w + gap;
    return [bar];
  });
  return (
    <svg viewBox={`0 0 ${x} 20`} preserveAspectRatio="none" className={className} aria-hidden>
      {bars.map((b) => (
        <rect key={b.i} x={b.x} y="0" width={b.w} height="20" fill="currentColor" />
      ))}
    </svg>
  );
}

const MEASURE: Record<string, string> = { chest: "Chest", length: "Length", sleeve: "Sleeve", waist: "Waist", inseam: "Inseam" };

/**
 * The store's promise, printed: fixed price and garment measurements in cm.
 * Used as art on the home hero and featured tiles.
 */
export function HangTag({ product, size = "M", colour, className = "" }: { product: Product; size?: Size; colour?: string; className?: string }) {
  const sku =
    product.variants.find((v) => v.size === size && (!colour || v.colour === colour))?.sku ?? product.variants[0]?.sku ?? product.id;
  const m = product.measurements[size];
  const rows = m ? Object.entries(m).slice(0, 3) : [];
  const price = product.salePrice ?? product.price;

  return (
    <div className={`hang-tag w-[200px] px-5 pb-4 pt-8 font-mono text-[11px] leading-snug shadow-[0_1px_0_rgba(0,0,0,0.08)] ${className}`}>
      <p className="truncate font-sans text-[12px] font-semibold uppercase tracking-[0.04em]">{product.name}</p>
      <p className="mt-2 text-[34px] font-semibold leading-none tracking-tight tabular-nums">{formatPrice(price)}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-steel-dark">Fixed · VAT incl.</p>
      {rows.length > 0 && (
        <dl className="mt-3 border-t border-dashed border-steel pt-2">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.1em] text-steel-dark">
            <dt>Size {size}</dt>
            <dd>cm</dd>
          </div>
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between tabular-nums">
              <dt>{MEASURE[k] ?? k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-3 flex items-end gap-2 border-t border-dashed border-steel pt-2">
        <Barcode value={sku} className="h-6 flex-1 text-ink" />
        <span className="text-[9px] uppercase tracking-[0.08em] text-steel-dark">RFID</span>
      </div>
      <p className="mt-1 text-[9px] tracking-[0.08em] text-steel-dark">{sku}</p>
    </div>
  );
}
