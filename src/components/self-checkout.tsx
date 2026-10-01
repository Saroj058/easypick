import { Fragment } from "react";

// The self-checkout section: a front view of the kiosk (CSS 3D), the steps, and the Nepali line.
// Everything here is static markup; the scan beam, glowing tags and stamp move with CSS only.

const STEPS = [
  ["1", "Put your clothes on the counter", "The tags scan by themselves."],
  ["2", "Check your list", "Every piece, with its price."],
  ["3", "Scan and pay with eSewa", "The QR is right on the screen."],
] as const;

const PROMISES = ["No bargaining", "No DM", "No queue", "Helper in store"];

const TRAIL = ["लगाएर हेर्नुहोस्", "मन पर्यो?", "स्क्यान गर्नुहोस्", "लग्नुहोस्"];

// A QR-like pattern for the drawing (decorative, not scannable). Seeded so server and client agree.
function qrCells() {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cells: [number, number][] = [];
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (!finder && rand() > 0.52) cells.push([x, y]);
    }
  }
  return cells;
}

function Qr() {
  return (
    <svg viewBox="0 0 21 21" fill="#0a0a0a" className="ks-qr" aria-hidden>
      {qrCells().map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
      ))}
      {[
        [0, 0],
        [14, 0],
        [0, 14],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="7" height="7" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="#ffffff" />
          <rect x={x + 2} y={y + 2} width="3" height="3" />
        </g>
      ))}
    </svg>
  );
}

function Marker({ n, className }: { n: string; className: string }) {
  return <span className={`ks-marker ${className}`}>{n}</span>;
}

function Tag({ className }: { className: string }) {
  return (
    <span className={`ks-tag ${className}`}>
      <span />
    </span>
  );
}

function Kiosk() {
  return (
    <div className="ks-wrap" aria-hidden>
      <div className="ks-scene">
        <div className="ks-floor" />
        <div className="ks-obj">
          <div className="ks-face ks-front">
            <div className="ks-head">
              <span className="ks-brand">
                EASYPICK.
              </span>
              <span className="ks-small">SELF-CHECKOUT</span>
            </div>
            <div className="ks-bezel">
              <div className="ks-screen">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[21px] tracking-[1px]">YOUR PIECES</span>
                  <span className="bg-ink px-1.5 py-0.5 text-[10px] text-paper">2 TAGS READ</span>
                </div>
                <div className="flex justify-between">
                  <span>✓ Coach Jacket · M</span>
                  <span>3,499</span>
                </div>
                <div className="flex justify-between">
                  <span>✓ Heavy Tee · M</span>
                  <span>999</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-steel pt-[7px] font-semibold">
                  <span>TOTAL</span>
                  <span>Rs 4,498</span>
                </div>
                <div className="mt-auto flex items-center gap-3">
                  <Qr />
                  <div className="flex flex-col gap-1">
                    <span className="font-sans text-[13px] font-bold">Scan with eSewa</span>
                    <span className="text-[11px] text-steel-dark">Pay Rs 4,498</span>
                  </div>
                </div>
                <span className="ks-glare" />
              </div>
            </div>
            <div className="ks-status">
              <span className="flex items-center gap-1.5">
                <span className="ks-led" />
                READY
              </span>
              <span className="flex gap-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="ks-dot" />
                ))}
              </span>
            </div>
            <div className="ks-grooves">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
            <div className="ks-help">
              <span className="ks-bell">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
                  <path d="M10 21h4" />
                </svg>
              </span>
              <span className="ks-small">NEED HELP? PRESS</span>
            </div>
            <div className="ks-strip" />
            <Marker n="2" className="ks-m2" />
            <Marker n="3" className="ks-m3" />
          </div>
          <div className="ks-face ks-side-r" />
          <div className="ks-face ks-side-l" />
          <div className="ks-face ks-top" />

          <div className="ks-counter">
            <div className="ks-face ks-c-top">
              <Tag className="ks-tag-a" />
              <span className="ks-beam" />
            </div>
            <div className="ks-pile">
              <span className="ks-pile-glow" />
              <span className="ks-jacket" />
              <span className="ks-tee" />
              <Tag className="ks-tag-b" />
              <Tag className="ks-tag-c" />
              <span className="ks-beam" />
            </div>
            <div className="ks-face ks-c-front">
              <Marker n="1" className="ks-m1" />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aeaeb2" strokeWidth="2">
                <path d="M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0" />
                <circle cx="12" cy="12" r="1.5" fill="#aeaeb2" />
              </svg>
              PLACE CLOTHES · TAGS SCAN AUTOMATICALLY
            </div>
            <div className="ks-face ks-c-side-r" />
            <div className="ks-face ks-c-side-l" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stamp() {
  return (
    <svg viewBox="0 0 100 100" className="ks-stamp" role="img" aria-label="Fully automatic store">
      <defs>
        <path id="ks-ring" d="M50 50 m-40 0 a40 40 0 1 1 80 0 a40 40 0 1 1 -80 0" />
      </defs>
      <circle cx="50" cy="50" r="49" fill="#ffffff" stroke="#0a0a0a" strokeWidth="1.2" />
      <g className="ks-spin">
        <text fontFamily="var(--font-jetbrains), monospace" fontWeight="600" fontSize="8.6" letterSpacing="1.6" fill="#0a0a0a">
          <textPath href="#ks-ring">FULLY AUTOMATIC STORE · FULLY AUTOMATIC STORE ·</textPath>
        </text>
      </g>
      <circle cx="50" cy="50" r="24" fill="#0a0a0a" />
      <path d="M53 34 L41 53 H50 L47 66 L59 47 H50 Z" fill="#c6ff3d" />
    </svg>
  );
}

function TrailArrow({ up }: { up: boolean }) {
  return (
    <svg aria-hidden width="40" height="20" viewBox="0 0 40 20" fill="none" stroke="#8e8e93" strokeWidth="1.5" className="h-4 w-6 shrink-0 md:h-5 md:w-12">
      <path d={`M2 10 Q 20 ${up ? -2 : 22} 34 10`} strokeDasharray="3 3" />
      <path d="M29 6 L35 10 L29 14" />
    </svg>
  );
}

export function SelfCheckout() {
  return (
    <section aria-labelledby="checkout-title" className="overflow-hidden bg-photo pb-14 md:pb-20">
      {/* Continues the Our store section above: same background, joined by a dashed line. */}
      <div className="container-ep">
        <div className="mb-12 border-t border-dashed border-steel md:mb-16" aria-hidden />
        {/* Wide screens: three columns with equal sides, so the kiosk sits exactly in the middle of the page. */}
        <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-8">
          <div className="lg:max-w-[420px]" data-reveal>
            <p className="mb-3 font-mono text-[12px] uppercase tracking-[0.14em] text-steel-dark">Inside the store · self-checkout</p>
            <h2 id="checkout-title" className="display text-[clamp(2.5rem,1.9rem+2.4vw,4rem)] leading-[0.92]">
              Pick it.
              <br />
              Scan it.
              <br />
              <span className="hl-volt">Walk out.</span>
            </h2>
            <p className="mt-4 max-w-[40ch] text-base text-steel-dark">
              The price is on the tag. The kiosk does the rest. A helper is always there if you need one.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {PROMISES.map((t) => (
                <li key={t} className="flex h-10 items-center gap-2 border border-ink bg-paper px-3 text-[14px] font-semibold">
                  <span className="h-2 w-2 rounded-full border border-ink bg-volt" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Phones and tablets: the kiosk on its own in the middle, the steps underneath. */}
          <div className="flex flex-col items-center gap-8 lg:contents">
            <Kiosk />
            <div className="flex w-full max-w-sm items-start gap-4 lg:w-[210px] lg:max-w-none lg:flex-col lg:gap-6 lg:justify-self-end">
              <ol aria-label="How to pay at the kiosk" className="ks-steps flex-1 lg:order-2">
                {STEPS.map(([n, t, d]) => (
                  <li key={n}>
                    <span className="ks-step-n">{n}</span>
                    <span className="flex flex-col gap-1 pt-1">
                      <span className="text-[15px] font-bold leading-tight">{t}</span>
                      <span className="text-[13px] leading-snug text-steel-dark">{d}</span>
                    </span>
                  </li>
                ))}
                <li>
                  <span className="ks-step-n ks-step-done" aria-hidden>
                    ✓
                  </span>
                  <span className="flex flex-col gap-1 pt-1">
                    <span className="text-[15px] font-bold leading-tight">Walk out</span>
                    <span className="text-[13px] leading-snug text-steel-dark">Your bill comes by SMS.</span>
                  </span>
                </li>
              </ol>
              <div className="w-[72px] shrink-0 lg:order-1 lg:w-[88px] lg:self-start">
                <Stamp />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-dashed border-steel pt-6 md:mt-14 md:pt-8">
          <p
            lang="ne"
            className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-center font-baloo text-[16px] font-bold leading-relaxed md:text-[19px] lg:flex-nowrap lg:text-[21px]"
          >
            {TRAIL.map((w, i) => (
              <Fragment key={w}>
                <span className="inline-block" style={{ transform: `rotate(${[-2, 1.5, -1, 2][i]}deg)` }}>
                  {w}
                </span>
                <TrailArrow up={i % 2 === 0} />
              </Fragment>
            ))}
            <span className="inline-block -rotate-2 rounded-full bg-volt px-2.5">अब, नो झन्झट!</span>
          </p>
        </div>
      </div>
    </section>
  );
}
