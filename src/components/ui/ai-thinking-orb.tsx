"use client";

import { useEffect, useRef, useState } from "react";

// A small sphere of dots that lights up in moving patterns while something is being worked out,
// with a label that cycles: Thinking, Searching, Analyzing, Composing. Taken from a shadcn-style
// "MorphOrb" (owner, 15 Oct 2026): only its dotted orb and labels, drawn in ink for Easypick's
// white panels; the morphing input was left out (Pick has its own Ask box, ui/animated-input.tsx).
// With reduced motion the orb holds still and the label doesn't change.

const LABELS = ["Thinking", "Searching", "Analyzing", "Composing"];
const CANVAS = 220;
const ORB_R = 66;
const TAU = Math.PI * 2;

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dots on rings around a sphere, the same each time.
const RINGS = 16;
const DOTS = (() => {
  const rand = mulberry32(7);
  const out: { x: number; y: number; z: number; u: number; seed: number }[] = [];
  for (let k = 0; k < RINGS; k++) {
    const y = 1 - ((k + 0.5) / RINGS) * 2;
    const r = Math.sqrt(1 - y * y);
    const m = Math.max(4, Math.round(30 * r));
    for (let j = 0; j < m; j++) {
      const a = (j / m) * TAU + k * 0.35;
      out.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, u: (1 - y) / 2, seed: rand() * TAU });
    }
  }
  return out;
})();
const N = DOTS.length;

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

export function ThinkingOrb({ size = 56, label = true, className = "" }: { size?: number; label?: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState(0);
  const prog = useRef(0);

  // The label (and the light pattern) moves on every 1.15 seconds.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setStep((s) => {
        const n = (s + 1) % LABELS.length;
        prog.current = n;
        return n;
      });
    }, 1150);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(CANVAS * dpr);
    el.height = Math.round(CANVAS * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const lit = new Float32Array(N);
    const weights = [1, 0, 0, 0];
    const CP = Math.cos(0.35);
    const SP = Math.sin(0.35);
    const C0 = CANVAS / 2;
    let time = still ? 1.2 : 0;
    let rot = 0;
    let k = still ? 1 : 0;
    let raf = 0;
    let last = performance.now();

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, CANVAS, CANVAS);
      time += dt;
      rot += 0.9 * dt;
      k = Math.min(1, k + dt / 0.8);
      const cyw = Math.cos(rot);
      const syw = Math.sin(rot);
      // Blend between the four light patterns as the label changes.
      const stepW = dt / 0.35;
      for (let q = 0; q < 4; q++) {
        const d = (q === prog.current ? 1 : 0) - weights[q];
        weights[q] += Math.abs(d) <= stepW ? d : d > 0 ? stepW : -stepW;
      }
      const decay = Math.exp(-dt / 0.5);
      const h0 = (time * 300) % N;
      const h3 = (time * 480) % N;
      const a1 = time * 0.8;
      const b1 = Math.sin(time * 0.5) * 0.9;
      const f1 = [Math.cos(b1) * Math.cos(a1), Math.sin(b1), Math.cos(b1) * Math.sin(a1)];
      const a2 = time * 0.55 + 2.1;
      const b2 = Math.cos(time * 0.42) * 0.9;
      const f2 = [Math.cos(b2) * Math.cos(a2), Math.sin(b2), Math.cos(b2) * Math.sin(a2)];
      const lat = Math.sin(time * 2.2);

      const front: [number, number, number, number][] = [];
      const back: [number, number, number, number][] = [];
      for (let n = 0; n < N; n++) {
        const { x: dx, y: dy, z: dz, u, seed } = DOTS[n];
        let pulse = 0;
        if (weights[0] > 0.001) {
          let dd = Math.abs(n - h0);
          if (dd > N - dd) dd = N - dd;
          const v = Math.max(0, 1 - dd / 16);
          pulse = Math.max(pulse, v * v * weights[0]);
        }
        if (weights[1] > 0.001) {
          const v = Math.max(0, (dx * f1[0] + dy * f1[1] + dz * f1[2] - 0.72) / 0.28, (dx * f2[0] + dy * f2[1] + dz * f2[2] - 0.72) / 0.28);
          pulse = Math.max(pulse, v * v * weights[1]);
        }
        if (weights[2] > 0.001) {
          const e = dy - lat;
          const v = Math.max(0, 1 - (e * e) / 0.02);
          pulse = Math.max(pulse, v * v * weights[2]);
        }
        if (weights[3] > 0.001) {
          let dd = Math.abs(n - h3);
          if (dd > N - dd) dd = N - dd;
          const v = Math.max(0, 1 - dd / 22);
          pulse = Math.max(pulse, v * v * weights[3]);
        }
        const l = Math.max(lit[n] * decay, pulse);
        lit[n] = l;

        // Top dots appear first.
        const ki = Math.min(1, Math.max(0, k * 1.6 - 0.6 * u));
        if (ki <= 0.001) continue;
        const eo = easeOut(ki);
        const x1 = dx * cyw + dz * syw;
        const z1 = -dx * syw + dz * cyw;
        const y2 = dy * CP - z1 * SP;
        const z2 = dy * SP + z1 * CP;
        const f = 2.8 / (2.8 - z2);
        const depth = (z2 + 1) / 2;
        const a = Math.min(1, 0.08 + 0.03 * Math.sin(seed + time * 1.6) + 0.3 * depth * depth + 0.7 * l) * eo;
        const r = (1.15 * (0.45 + 0.75 * depth) * f + 0.9 * l) * (0.4 + 0.6 * eo);
        (depth >= 0.5 ? front : back).push([C0 + x1 * ORB_R * eo * f, C0 - y2 * ORB_R * eo * f, r, a]);
      }
      for (const list of [back, front]) {
        for (const [x, y, r, a] of list) {
          if (a <= 0.01) continue;
          ctx.fillStyle = `rgba(10,10,10,${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.fill();
        }
      }
    };

    const frame = (now: number) => {
      const dt = still ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
      if (!still) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span className={`inline-flex items-center gap-3 ${className}`} role="status" aria-label={`${LABELS[step]}…`}>
      <canvas ref={canvas} aria-hidden style={{ width: size, height: size }} />
      {label && (
        <span key={step} className="animate-fade-up text-[14px] font-semibold text-steel-dark">
          {LABELS[step]}
          <span aria-hidden className="ml-0.5 inline-flex gap-0.5 align-middle">
            {[0, 1, 2].map((d) => (
              <i key={d} className="inline-block h-1 w-1 rounded-full bg-steel-dark motion-safe:animate-pulse" style={{ animationDelay: `${d * 160}ms` }} />
            ))}
          </span>
        </span>
      )}
    </span>
  );
}

export default ThinkingOrb;
