"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// deterministic 2-octave value noise, no deps
// ---------------------------------------------------------------------------
function hash2(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function noise2(x: number, y: number) {
  return 0.65 * vnoise(x, y) + 0.35 * vnoise(x * 2.1 + 19.7, y * 2.1 + 7.3);
}

// ---------------------------------------------------------------------------
// VaporCountdown: a live countdown (days, hours, minutes, seconds) where every
// digit change is a phase change: the outgoing digit breaks into grains that
// drift up on a curl-noise wind while the incoming digit condenses out of the
// same cloud, grains springing to their places in the new glyph.
//
// The digits themselves are real text inside a <time> element. A digit at rest
// is that text, crisp at any size; only while it is changing is it hidden and
// drawn as grains on the canvas over it. The canvas loop runs only while some
// digit is changing, and writes straight to the DOM: no React state per frame.
// ---------------------------------------------------------------------------

const FLOATS = 6; // grains: x, y, vx, vy, hx, hy · vapor: x, y, vx, vy, age, life
const MAX_GRAINS = 2500; // per digit
const SPRING_K = 90; // s⁻²
const ZETA = 0.55; // damping ratio; under 1 gives a soft overshoot as the digit condenses
const DRAG = 0.92; // per-frame velocity drag
const DT_MAX = 0.032; // s: clamps the jump after a tab switch
const FIELD_SCALE = 0.008; // px → noise units for the wind field
const CURL_EPS = 0.75; // finite-difference step for the curl, in noise units
const PAD_X = 40; // canvas overdraw, so vapor is not clipped at the digits' box
const PAD_TOP = 110;
const PAD_BOTTOM = 20;
const GROUPS = 4; // days, hours, minutes, seconds
const DIGITS = GROUPS * 2;

const DEFAULT_LABELS = ["days", "hrs", "min", "sec"] as const;

type Slot = {
  g: Float32Array; // incoming grains
  v: Float32Array; // sublimating vapor grains
  gc: number;
  vc: number;
  active: boolean;
};

export function VaporCountdown({
  targetDate,
  labels = DEFAULT_LABELS,
  className = "",
  labelClassName = "",
}: {
  /** What it counts down to: a Date, an ISO string or epoch ms. */
  targetDate: Date | string | number;
  /** The words under the four pairs; null hides the row. */
  labels?: readonly [string, string, string, string] | null;
  /** Classes for the root. The digits take their size, face and colour from here. */
  className?: string;
  labelClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLTimeElement>(null);

  // A stable primitive for the effect (a Date is a new object every render).
  const targetKey = targetDate instanceof Date ? targetDate.getTime() : targetDate;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const timeEl = timeRef.current;
    if (!root || !canvas || !timeEl) return;
    const digitEls = Array.from(root.querySelectorAll<HTMLSpanElement>("[data-vc-digit]"));
    if (digitEls.length !== DIGITS) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targetMs = typeof targetKey === "number" ? targetKey : new Date(targetKey).getTime();

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let digits = "0".repeat(DIGITS);

    const remaining = () => Math.max(0, targetMs - Date.now());
    const two = (n: number) => String(n).padStart(2, "0");
    const toDigits = () => {
      const rem = Math.floor(remaining() / 1000);
      return two(Math.min(99, Math.floor(rem / 86400))) + two(Math.floor((rem % 86400) / 3600)) + two(Math.floor((rem % 3600) / 60)) + two(rem % 60);
    };
    const applyDateTime = () => {
      timeEl.setAttribute("datetime", `P${Number(digits.slice(0, 2))}DT${digits.slice(2, 4)}H${digits.slice(4, 6)}M${digits.slice(6)}S`);
    };

    // ---- canvas and grains (unused with reduced motion) --------------------
    const ctx = canvas.getContext("2d");
    let grainColor = getComputedStyle(digitEls[0]).color || "#ffffff";

    const slots: Slot[] = Array.from({ length: DIGITS }, () => ({
      g: new Float32Array(MAX_GRAINS * FLOATS),
      v: new Float32Array(MAX_GRAINS * FLOATS),
      gc: 0,
      vc: 0,
      active: false,
    }));
    let glyphs: Float32Array[] | null = null; // where each digit 0-9's grains sit, relative to its cell
    let cells: { x: number; y: number }[] = [];
    let cw = 0;
    let ch = 0;
    let lastW = 0;
    let lastH = 0;
    let dot = 2; // a grain's size in px
    let raf = 0;
    let last = 0;
    const dampC = 2 * ZETA * Math.sqrt(SPRING_K); // s⁻¹

    /** A digit at rest is its own text; while it changes, the text hides and the grains stand in. */
    const rest = (s: number, atRest: boolean) => {
      digitEls[s].style.opacity = atRest ? "" : "0";
    };

    const loop = (now: number) => {
      if (!ctx) return;
      const dt = Math.min(Math.max((now - last) / 1000, 0), DT_MAX);
      last = now;
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = grainColor;
      let anyActive = false;
      const half = dot / 2;

      for (let s = 0; s < DIGITS; s++) {
        const slot = slots[s];
        if (!slot.active) continue; // at rest: the text is showing
        const g = slot.g;
        const v = slot.v;
        anyActive = true;
        let settled = true;

        // incoming grains: an underdamped spring towards their places in the glyph
        for (let i = 0; i < slot.gc; i++) {
          const o = i * FLOATS;
          let x = g[o];
          let y = g[o + 1];
          let vx = g[o + 2];
          let vy = g[o + 3];
          const hx = g[o + 4];
          const hy = g[o + 5];

          vx = (vx + (SPRING_K * (hx - x) - dampC * vx) * dt) * DRAG;
          vy = (vy + (SPRING_K * (hy - y) - dampC * vy) * dt) * DRAG;
          x += vx * dt;
          y += vy * dt;

          g[o] = x;
          g[o + 1] = y;
          g[o + 2] = vx;
          g[o + 3] = vy;

          if (Math.abs(x - hx) > 0.5 || Math.abs(y - hy) > 0.5 || Math.abs(vx) > 2 || Math.abs(vy) > 2) settled = false;

          ctx.globalAlpha = 0.95;
          ctx.fillRect(x - half, y - half, dot, dot);
        }

        // vapor grains: curl-noise wind with an upward lean, fading over their life
        let j = 0;
        while (j < slot.vc) {
          const o = j * FLOATS;
          const age = v[o + 4] + dt * 1000;
          const life = v[o + 5];
          if (age >= life) {
            // swap-remove with the last live vapor grain
            const lo = (slot.vc - 1) * FLOATS;
            for (let k = 0; k < FLOATS; k++) v[o + k] = v[lo + k];
            slot.vc--;
            continue;
          }
          v[o + 4] = age;
          let x = v[o];
          let y = v[o + 1];
          let vx = v[o + 2];
          let vy = v[o + 3];

          // wind = curl of the noise field: (∂n/∂y, -∂n/∂x), which has no divergence
          const nx = x * FIELD_SCALE;
          const ny = y * FIELD_SCALE;
          const dndx = noise2(nx + CURL_EPS, ny) - noise2(nx - CURL_EPS, ny);
          const dndy = noise2(nx, ny + CURL_EPS) - noise2(nx, ny - CURL_EPS);
          let wx = dndy;
          let wy = -dndx;
          const cl = Math.hypot(wx, wy) || 1;
          const sp = 40 + 50 * hash2(j * 1.31, s * 7.7); // 40-90 px/s per grain
          wx = (wx / cl) * sp * 0.6;
          wy = (wy / cl) * sp * 0.6 - sp * 0.8; // upward lean
          const mix = Math.min(1, dt * 5);
          vx += (wx - vx) * mix;
          vy += (wy - vy) * mix;
          x += vx * dt;
          y += vy * dt;

          v[o] = x;
          v[o + 1] = y;
          v[o + 2] = vx;
          v[o + 3] = vy;

          ctx.globalAlpha = (1 - age / life) * 0.8;
          ctx.fillRect(x - half, y - half, dot, dot);
          j++;
        }
        if (slot.vc > 0) settled = false;

        if (settled) {
          slot.active = false;
          rest(s, true);
        }
      }
      ctx.globalAlpha = 1;
      if (anyActive) raf = requestAnimationFrame(loop);
      else {
        raf = 0;
        ctx.clearRect(0, 0, cw, ch);
      }
    };

    const wake = () => {
      if (!raf && ctx) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    /** The digit in slot `s` changes from `from` to `to`. */
    const transition = (s: number, from: number, to: number) => {
      if (!glyphs) return;
      const slot = slots[s];
      const g = slot.g;
      const v = slot.v;
      const cell = cells[s];

      // the outgoing digit sublimates: its grains (or, from rest, its glyph) become vapor
      let vc = 0;
      if (slot.active) {
        for (let i = 0; i < slot.gc && vc < MAX_GRAINS; i++) {
          const o = i * FLOATS;
          const vo = vc * FLOATS;
          v[vo] = g[o];
          v[vo + 1] = g[o + 1];
          v[vo + 2] = g[o + 2] * 0.4;
          v[vo + 3] = g[o + 3] * 0.4 - 12;
          v[vo + 4] = 0;
          v[vo + 5] = 600 + Math.random() * 300; // ms
          vc++;
        }
      } else {
        const old = glyphs[from];
        for (let i = 0; i < old.length / 2 && vc < MAX_GRAINS; i++) {
          const vo = vc * FLOATS;
          v[vo] = cell.x + old[i * 2];
          v[vo + 1] = cell.y + old[i * 2 + 1];
          v[vo + 2] = 0;
          v[vo + 3] = -12; // a small upward kick at release
          v[vo + 4] = 0;
          v[vo + 5] = 600 + Math.random() * 300;
          vc++;
        }
      }
      slot.vc = vc;

      // the incoming digit condenses out of the departing cloud
      const homes = glyphs[to];
      const n = homes.length / 2;
      slot.gc = n;
      for (let i = 0; i < n; i++) {
        const o = i * FLOATS;
        const hx = cell.x + homes[i * 2];
        const hy = cell.y + homes[i * 2 + 1];
        if (vc > 0) {
          const src = ((Math.random() * vc) | 0) * FLOATS;
          g[o] = v[src] + (Math.random() - 0.5) * 10;
          g[o + 1] = v[src + 1] + (Math.random() - 0.5) * 10;
          g[o + 2] = (Math.random() - 0.5) * 40;
          g[o + 3] = -20 - Math.random() * 40;
        } else {
          g[o] = hx;
          g[o + 1] = hy;
          g[o + 2] = 0;
          g[o + 3] = 0;
        }
        g[o + 4] = hx;
        g[o + 5] = hy;
      }
      slot.active = true;
      rest(s, false);
    };

    /** Measures the digits and rasterises 0-9 into grain positions. Run again whenever the box changes size. */
    const init = () => {
      if (!ctx) return;
      const rootRect = root.getBoundingClientRect();
      const w = Math.round(rootRect.width);
      const h = Math.round(rootRect.height);
      if (w < 2 || h < 2) return;
      lastW = w;
      lastH = h;
      cw = w + PAD_X * 2;
      ch = h + PAD_TOP + PAD_BOTTOM;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      grainColor = getComputedStyle(digitEls[0]).color || grainColor;

      cells = digitEls.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - rootRect.left + PAD_X, y: r.top - rootRect.top + PAD_TOP };
      });

      // tabular figures: every cell is the same size, so one raster per digit serves all eight
      const cellRect = digitEls[0].getBoundingClientRect();
      const gw = Math.max(2, Math.ceil(cellRect.width));
      const gh = Math.max(2, Math.ceil(cellRect.height));
      // small digits get finer grains, so the glyph still reads while it forms
      const stride = gh < 48 ? 2 : 3;
      dot = gh < 48 ? 1.6 : 2;
      const off = document.createElement("canvas");
      off.width = gw;
      off.height = gh;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      const cs = getComputedStyle(digitEls[0]);
      octx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillStyle = "#ffffff";
      glyphs = [];
      for (let d = 0; d < 10; d++) {
        octx.clearRect(0, 0, gw, gh);
        octx.fillText(String(d), gw / 2, gh / 2);
        const alpha = octx.getImageData(0, 0, gw, gh).data;
        const pts: number[] = [];
        for (let y = 1; y < gh; y += stride) {
          const row = y * gw;
          for (let x = 1; x < gw; x += stride) {
            if (alpha[(row + x) * 4 + 3] > 128) pts.push(x, y);
          }
        }
        const total = pts.length / 2;
        const keepEvery = Math.max(1, Math.ceil(total / MAX_GRAINS));
        const homes = new Float32Array(Math.ceil(total / keepEvery) * 2);
        let n = 0;
        for (let i = 0; i < total; i += keepEvery) {
          homes[n * 2] = pts[i * 2];
          homes[n * 2 + 1] = pts[i * 2 + 1];
          n++;
        }
        glyphs.push(homes.subarray(0, n * 2));
      }

      // every digit at rest, as its own text
      for (let s = 0; s < DIGITS; s++) {
        slots[s].gc = 0;
        slots[s].vc = 0;
        slots[s].active = false;
        rest(s, true);
      }
      ctx.clearRect(0, 0, cw, ch);
    };

    // ---- the clock: wakes on each second ------------------------------------
    const schedule = () => {
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 15);
    };
    const tick = () => {
      const next = toDigits();
      if (next !== digits) {
        // a tab in the background just catches up, with no show nobody sees
        const show = !reduced && !document.hidden;
        for (let s = 0; s < DIGITS; s++) {
          if (next.charAt(s) !== digits.charAt(s)) {
            digitEls[s].textContent = next.charAt(s);
            if (show) transition(s, Number(digits.charAt(s)), Number(next.charAt(s)));
          }
        }
        digits = next;
        applyDateTime();
        if (show) wake();
      }
      if (remaining() > 0) schedule();
    };

    digits = toDigits();
    for (let s = 0; s < DIGITS; s++) digitEls[s].textContent = digits.charAt(s);
    applyDateTime();
    if (remaining() > 0) schedule();

    if (reduced || !ctx) {
      // reduced motion: the canvas stays hidden (CSS) and the text simply changes
      return () => {
        disposed = true;
        if (timer) clearTimeout(timer);
      };
    }

    let ro: ResizeObserver | undefined;
    // rasterise only once the face has loaded: a fallback font's shapes would be wrong
    document.fonts.ready.then(() => {
      if (disposed) return;
      init();
      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const w = Math.round(entry.contentRect.width);
        const h = Math.round(entry.contentRect.height);
        if (w !== lastW || h !== lastH) init();
      });
      ro.observe(root);
    });

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      digitEls.forEach((el) => (el.style.opacity = ""));
    };
  }, [targetKey]);

  return (
    <div ref={rootRef} className={`relative inline-grid select-none ${className}`} style={{ gridTemplateColumns: `repeat(${GROUPS}, auto)`, columnGap: "0.45em", rowGap: "0.5rem" }}>
      <time ref={timeRef} aria-live="off" style={{ display: "contents" }}>
        {Array.from({ length: GROUPS }, (_, group) => (
          <span key={group} className="flex justify-center font-semibold leading-none tabular-nums">
            <span data-vc-digit>0</span>
            <span data-vc-digit>0</span>
          </span>
        ))}
      </time>
      {labels &&
        labels.map((label) => (
          <span key={label} className={`text-center text-[11px] uppercase tracking-[0.14em] opacity-70 ${labelClassName}`}>
            {label}
          </span>
        ))}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute motion-reduce:hidden"
        style={{ left: -PAD_X, top: -PAD_TOP, width: `calc(100% + ${PAD_X * 2}px)`, height: `calc(100% + ${PAD_TOP + PAD_BOTTOM}px)` }}
      />
    </div>
  );
}

export default VaporCountdown;
