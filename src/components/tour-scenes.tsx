import { HangTag } from "./hang-tag";
import { GarmentSvg } from "./product-image";
import type { Product } from "@/lib/types";

// The virtual tour's scenes: drawn, not photographed (the store isn't fitted out yet), in the
// site's own style: ink, graphite, paper, one lime accent. Each fills a 4:3 frame.

const frame = "relative aspect-[4/3] w-full overflow-hidden";

/** A QR-like pattern for the kiosk screen: finder squares plus a fixed scatter. Decorative only. */
function FakeQr({ className = "" }: { className?: string }) {
  const n = 21;
  const cells: [number, number][] = [];
  let seed = 7;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const finder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
      seed = (seed * 9301 + 49297) % 233280;
      if (!finder && seed / 233280 > 0.52) cells.push([x, y]);
    }
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#0a0a0a" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="#0a0a0a" />
    </g>
  );
  return (
    <svg viewBox="-1 -1 23 23" className={className} aria-hidden>
      <rect x="-1" y="-1" width="23" height="23" fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill="#0a0a0a" />
      ))}
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
    </svg>
  );
}

/** 01: the shutter, half up, light spilling out. */
export function DoorScene() {
  return (
    <div className={`${frame} bg-[#1c1c1e]`}>
      {/* the street wall */}
      <div className="absolute inset-x-[14%] bottom-0 top-[12%] bg-ink" />
      {/* inside, lit */}
      <div className="absolute inset-x-[20%] bottom-0 top-[30%] bg-paper">
        <div className="absolute inset-x-[10%] top-[18%] h-[3px] bg-steel" />
        {[10, 26, 42, 58, 74].map((l, i) => (
          <div key={l} className="absolute top-[20%] w-[12%]" style={{ left: `${l}%` }}>
            <GarmentSvg category={i % 2 ? "hoodies" : "tees"} colourHex={["#0a0a0a", "#6b705c", "#e5e5e5", "#1f3a5f", "#c6ff3d"][i]} className="w-full" />
          </div>
        ))}
      </div>
      {/* the shutter, rolled half up */}
      <div className="shutter absolute inset-x-[20%] top-[30%] h-[34%]" />
      {/* sign */}
      <p className="display absolute left-1/2 top-[15%] -translate-x-1/2 text-[clamp(20px,5vw,40px)] leading-none text-paper">
        easypick<span className="text-volt">.</span>
      </p>
      <span className="absolute right-[22%] top-[17%] h-3 w-3 rounded-full bg-volt" />
      {/* the greeter's hello */}
      <p className="absolute bottom-[8%] left-[24%] bg-volt px-3 py-1.5 font-mono text-[12px] font-semibold text-ink">AAUNUS.</p>
    </div>
  );
}

/** 02: a rail of pieces, one tag turned so you can read it. */
export function RackScene({ product }: { product: Product | null }) {
  const pieces: [string, string][] = [
    ["tees", "#0a0a0a"],
    ["hoodies", "#6b705c"],
    ["jackets", "#1c1c1e"],
    ["tees", "#e5e5e5"],
    ["hoodies", "#1f3a5f"],
  ];
  return (
    <div className={`${frame} bg-graphite`}>
      <div className="absolute inset-x-[6%] top-[14%] h-[3px] rounded bg-paper/50" />
      <div className="absolute inset-x-[8%] top-[15%] flex justify-between">
        {pieces.map(([c, hex], i) => (
          <div key={i} className="w-[17%]">
            <GarmentSvg category={c as Product["category"]} colourHex={hex} className="w-full" />
          </div>
        ))}
      </div>
      {product && (
        <div className="absolute bottom-[6%] right-[5%] origin-top-right rotate-[4deg] scale-[0.72] sm:scale-90">
          <HangTag product={product} />
        </div>
      )}
      <p className="absolute bottom-[8%] left-[6%] max-w-[46%] font-mono text-[11px] uppercase leading-snug tracking-[0.1em] text-paper/80">
        Fixed price. Size in cm. Nobody follows you.
      </p>
    </div>
  );
}

/** 03: three fitting rooms, one curtain drawn, a numbered token. */
export function FittingScene() {
  return (
    <div className={`${frame} bg-photo`}>
      <div className="absolute inset-x-[8%] bottom-[10%] top-[10%] flex gap-[3%]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative flex-1 bg-paper">
            <div className="absolute inset-x-0 top-0 h-[4px] bg-ink" />
            {/* curtain: open on the middle room */}
            <div
              className={`absolute top-[4px] h-[calc(100%-4px)] bg-[repeating-linear-gradient(90deg,#2a2a2c_0_8px,#1c1c1e_8px_16px)] ${i === 1 ? "left-0 w-[22%]" : "inset-x-0"}`}
            />
            {i === 1 && (
              <>
                <div className="absolute bottom-[12%] left-[35%] right-[10%] top-[10%] border-2 border-steel bg-gradient-to-br from-white to-mist" />
                <p className="absolute bottom-[4%] right-[8%] font-mono text-[11px] text-steel-dark">FREE</p>
              </>
            )}
          </div>
        ))}
      </div>
      {/* the token */}
      <div className="absolute bottom-[5%] left-[5%] flex h-16 w-16 flex-col items-center justify-center rounded-full bg-volt text-ink shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)] sm:h-20 sm:w-20">
        <span className="font-mono text-[10px]">TOKEN</span>
        <span className="display text-[28px] leading-none sm:text-[34px]">07</span>
      </div>
    </div>
  );
}

/** 04: the helper on the floor. */
export function HelperScene() {
  return (
    <div className={`${frame} bg-paper`}>
      <div className="absolute inset-x-0 bottom-0 h-[22%] bg-photo" />
      {/* a simple figure in the Easypick tee */}
      <svg viewBox="0 0 100 140" className="absolute bottom-[14%] left-[18%] h-[70%]" aria-hidden>
        <circle cx="50" cy="22" r="14" fill="#2a2a2c" />
        <path d="M22 54 Q50 40 78 54 L82 100 H18 Z" fill="#0a0a0a" />
        <rect x="44" y="60" width="12" height="6" fill="#c6ff3d" />
        <rect x="24" y="100" width="20" height="38" fill="#3a3a3c" />
        <rect x="56" y="100" width="20" height="38" fill="#3a3a3c" />
      </svg>
      <div className="absolute right-[8%] top-[16%] max-w-[52%] bg-ink px-4 py-3 text-paper">
        <p className="text-[15px] font-semibold sm:text-lg">Need another size?</p>
        <p className="mt-1 text-[13px] text-paper/70">Wave. I&apos;ll bring it.</p>
        <span className="absolute -bottom-2 left-6 h-4 w-4 rotate-45 bg-ink" />
      </div>
      <p className="absolute bottom-[5%] right-[6%] font-mono text-[11px] uppercase tracking-[0.1em] text-steel-dark">One helper · on the floor</p>
    </div>
  );
}

/** 05: the self-checkout kiosk, pieces listed, QR on screen. */
export function KioskScene() {
  return (
    <div className={`${frame} bg-graphite`}>
      {/* kiosk body */}
      <div className="absolute bottom-0 left-1/2 top-[8%] w-[52%] -translate-x-1/2 bg-ink">
        <div className="absolute inset-x-[8%] top-[5%] h-[56%] bg-paper p-[5%] font-mono text-[9px] leading-snug text-ink sm:text-[11px]">
          <p className="font-semibold">YOUR PIECES</p>
          <p className="mt-1 flex justify-between">
            <span>Heavy Tee · M</span>
            <span>1,999</span>
          </p>
          <p className="flex justify-between">
            <span>Hoodie · L</span>
            <span>3,499</span>
          </p>
          <p className="mt-1 flex justify-between border-t border-dashed border-steel pt-1 font-semibold">
            <span>TOTAL</span>
            <span>Rs 5,498</span>
          </p>
          <FakeQr className="mx-auto mt-[6%] w-[42%]" />
          <p className="mt-1 text-center">Scan with eSewa</p>
        </div>
        {/* the tray */}
        <div className="absolute inset-x-[4%] top-[66%] h-[10%] bg-[#2a2a2c]" />
        <p className="absolute inset-x-0 top-[80%] text-center font-mono text-[10px] tracking-[0.12em] text-volt">SELF-CHECKOUT</p>
      </div>
      {/* a phone scanning */}
      <div className="absolute bottom-[12%] right-[8%] h-[34%] w-[16%] rotate-[-10deg] rounded-[10px] border-4 border-[#3a3a3c] bg-ink">
        <p className="mt-[40%] text-center font-mono text-[9px] font-semibold text-volt">PAID ✓</p>
      </div>
    </div>
  );
}

/** 06: the pickup counter, a bag with an order number. */
export function CounterScene() {
  return (
    <div className={`${frame} bg-photo`}>
      <div className="absolute inset-x-[6%] bottom-0 h-[34%] bg-ink" />
      <div className="absolute inset-x-[6%] bottom-[34%] h-[4%] bg-steel" />
      {/* the bag */}
      <div className="absolute bottom-[38%] left-[34%] h-[36%] w-[28%] bg-paper shadow-[0_10px_24px_-12px_rgba(0,0,0,0.4)]">
        <div className="absolute -top-[18%] left-1/2 h-[24%] w-[40%] -translate-x-1/2 rounded-t-full border-[3px] border-b-0 border-ink" />
        <p className="mt-[28%] text-center font-semibold">easypick</p>
        <p className="mt-2 text-center font-mono text-[10px] text-steel-dark">EP-1000214</p>
      </div>
      <p className="absolute bottom-[12%] left-[10%] font-mono text-[11px] uppercase tracking-[0.1em] text-paper/80">Online orders · show the SMS</p>
      <p className="absolute bottom-[12%] right-[10%] bg-volt px-2 py-1 font-mono text-[11px] font-semibold text-ink">FREE PICKUP</p>
    </div>
  );
}

/** 07: out through the gate, into the street. */
export function ExitScene() {
  return (
    <div className={`${frame} bg-volt`}>
      <div className="absolute bottom-0 left-[18%] top-[20%] w-[4%] bg-ink" />
      <div className="absolute bottom-0 right-[18%] top-[20%] w-[4%] bg-ink" />
      <p className="display absolute inset-x-0 top-[34%] text-center text-[clamp(40px,11vw,96px)] leading-none text-ink">Wear it.</p>
      <p className="absolute inset-x-0 bottom-[10%] text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink">Bill by SMS · no queue</p>
    </div>
  );
}
