"use client";

import { Archivo } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "./site-intro.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

/** Set once the intro has played: once per visit (until the tab or window is closed). */
const SEEN = "ep-intro-seen";
const WORDS = ["Pick it.", "Pay it.", "Wear it."];

/**
 * The opening of the website (owner, 28 Oct 2026): the lime dot bounces and stamps PICK IT. PAY IT. WEAR IT., the
 * ground flipping black and white out from each landing; it glides to the middle and floods the screen black; the
 * Easypick logo comes up in white; the black closes away and the logo, now black, glides up and shrinks into the
 * logo in the nav bar, as the page shows through. Once per visit, with Skip; never for people who ask for less motion.
 */
export function SiteIntro() {
  const root = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(SEEN);
    } catch {
      /* private mode */
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Automated browsers (tests) don't get it; "ep-intro-try" in localStorage lets one see it.
    const robot = navigator.webdriver && !localStorage.getItem("ep-intro-try");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- decided once, after mount, from this visit's storage
    if (!seen && !still && !robot) setOn(true);
  }, []);

  useEffect(() => {
    const stage = root.current;
    if (!on || !stage) return;
    const $ = <T extends HTMLElement>(s: string) => stage.querySelector(s) as T;
    const dot = $(".si-dot"), flip = $(".si-flip"), flood = $(".si-flood"), wordsEl = $(".si-words"), logo = $(".si-logo"), skip = $<HTMLButtonElement>(".si-skip");
    const words = [...wordsEl.children] as HTMLElement[];
    const target = document.querySelector<HTMLElement>('header a[aria-label="Easypick home"] img');
    const timers: number[] = [], anims: Animation[] = [];
    let raf = 0, alive = true, dark = false;
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const go = (el: Element, keys: Keyframe[], opts: KeyframeAnimationOptions) => {
      const a = el.animate(keys, { fill: "forwards", ...opts });
      anims.push(a);
      return a;
    };
    const T = (x: number, y: number, r = 0, sx = 1, sy = 1) => `translate(${x}px, ${y}px) rotate(${r}rad) scale(${sx}, ${sy})`;
    const C = (rad: number, x: number, y: number) => `circle(${rad}px at ${x}px ${y}px)`;

    try {
      sessionStorage.setItem(SEEN, "1");
    } catch {
      /* private mode: it simply plays again next time */
    }
    document.documentElement.style.overflow = "hidden";
    if (target) target.style.visibility = "hidden";

    const finish = () => {
      if (!alive) return;
      alive = false;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      anims.forEach((a) => a.cancel());
      document.documentElement.style.overflow = "";
      if (target) target.style.visibility = "";
      setOn(false);
    };

    const W = stage.clientWidth, H = stage.clientHeight, R = Math.hypot(W, H);
    const small = W <= 640, r0 = small ? 10 : 13;
    const wb = wordsEl.getBoundingClientRect();
    const spots = words.map((w) =>
      small
        ? { x: wb.left + w.offsetLeft + w.offsetWidth + r0 + 8, y: wb.top + w.offsetTop + w.offsetHeight * 0.62 }
        : { x: wb.left + w.offsetLeft + w.offsetWidth / 2, y: wb.top + w.offsetTop + w.offsetHeight * 0.1 - r0 },
    );
    const last = spots[spots.length - 1];
    // One gravity: a fall, a bounce to each word, a small hop to settle.
    const G = 2600, hop = small ? Math.min(90, H * 0.12) : Math.min(150, H * 0.2);
    const start = small ? { x: spots[0].x + 40, y: -30 } : { x: spots[0].x - Math.min(260, W * 0.25), y: -30 };
    const legs = [{ a: start, b: spots[0], h: 0, ms: Math.sqrt((2 * (spots[0].y - start.y)) / G) * 1000, land: 0 }];
    for (let i = 1; i < spots.length; i++) legs.push({ a: spots[i - 1], b: spots[i], h: i === spots.length - 1 ? hop * 0.8 : hop, ms: 2 * Math.sqrt((2 * hop) / G) * 1000, land: i });
    legs.push({ a: last, b: last, h: 16, ms: 2 * Math.sqrt(32 / G) * 1000, land: -1 });

    const land = (p: { x: number; y: number }, i: number) => {
      words[i].classList.add("on");
      go(flip, dark ? [{ clipPath: C(R, p.x, p.y) }, { clipPath: C(0, p.x, p.y) }] : [{ clipPath: C(0, p.x, p.y) }, { clipPath: C(R, p.x, p.y) }], { duration: 480, easing: "cubic-bezier(.4,0,.2,1)" });
      dark = !dark;
      const rp = document.createElement("span");
      rp.className = "si-ripple";
      rp.style.left = `${p.x}px`;
      rp.style.top = `${p.y + r0}px`;
      stage.appendChild(rp);
      window.setTimeout(() => rp.remove(), 700);
    };

    // After the bounce: the words go, the dot glides to the middle and floods black; the logo comes up in white;
    // the black closes away and the logo, turned black, glides into the nav bar's logo as the page shows through.
    const after = () => {
      at(320, () => {
        wordsEl.classList.add("out");
        if (dark) {
          go(flip, [{ clipPath: C(R, last.x, last.y) }, { clipPath: C(0, last.x, last.y) }], { duration: 420, easing: "cubic-bezier(.4,0,.2,1)" });
          dark = false;
        }
        go(dot, [{ transform: T(last.x, last.y) }, { transform: T(W / 2, H / 2) }], { duration: 420, easing: "cubic-bezier(.65,0,.35,1)" });
      });
      at(740, () => {
        go(dot, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
        go(flood, [{ clipPath: C(r0, W / 2, H / 2) }, { clipPath: C(R, W / 2, H / 2) }], { duration: 600, easing: "cubic-bezier(.7,0,.15,1)" });
      });
      at(1180, () => {
        logo.classList.add("on");
        // Its own fade in, then let go, so the switch to black (a filter) can take over.
        logo
          .animate([{ opacity: 0, transform: "translate(-50%, -50%) scale(.86)", filter: "blur(6px)" }, { opacity: 1, transform: "translate(-50%, -50%) scale(1)", filter: "blur(0)" }], { duration: 700, easing: "cubic-bezier(.22,1,.36,1)" })
          .finished.then(() => alive && (logo.style.opacity = "1"))
          .catch(() => {});
      });
      at(2700, () => {
        logo.classList.add("ink");
        go(flood, [{ clipPath: C(R, W / 2, H / 2) }, { clipPath: C(0, W / 2, H / 2) }], { duration: 640, easing: "cubic-bezier(.76,0,.24,1)" });
      });
      at(3400, () => {
        const from = logo.getBoundingClientRect();
        const to = target?.getBoundingClientRect();
        go(stage, [{ backgroundColor: "rgba(255,255,255,1)" }, { backgroundColor: "rgba(255,255,255,0)" }], { duration: 760, easing: "ease-in-out" });
        if (to && to.width) {
          const k = to.width / from.width;
          const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
          go(logo, [{ transform: "translate(-50%, -50%) scale(1)" }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${k})` }], { duration: 820, easing: "cubic-bezier(.65,0,.35,1)" })
            .finished.then(finish)
            .catch(() => {});
        } else {
          go(logo, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 }).finished.then(finish).catch(() => {});
        }
      });
    };

    let leg = 0, t0 = performance.now() + 350, holdTo = t0;
    const step = (now: number) => {
      if (!alive) return;
      if (now < holdTo) {
        raf = requestAnimationFrame(step);
        return;
      }
      const L = legs[leg], t = Math.min(1, (now - t0) / L.ms), fall = leg === 0;
      const x = L.a.x + (L.b.x - L.a.x) * t;
      const y = fall ? L.a.y + (L.b.y - L.a.y) * t * t : L.a.y + (L.b.y - L.a.y) * t - 4 * L.h * t * (1 - t);
      // Stretch along the direction of travel, by speed; squash only on contact.
      const vx = L.b.x - L.a.x, vy = fall ? 2 * (L.b.y - L.a.y) * t : L.b.y - L.a.y - 4 * L.h * (1 - 2 * t);
      const speed = Math.min(1, Math.hypot(vx, vy) / 900);
      if (t < 1) {
        dot.style.transform = T(x, y, Math.atan2(vy, vx || 0.0001), 1 + 0.38 * speed, 1 - 0.2 * speed);
        raf = requestAnimationFrame(step);
        return;
      }
      dot.style.transform = T(L.b.x, L.b.y + r0 * 0.3, 0, 1.32, 0.7);
      if (L.land >= 0) land(L.b, L.land);
      if (++leg < legs.length) {
        holdTo = t0 = now + 70;
        raf = requestAnimationFrame(step);
      } else {
        dot.style.transform = T(last.x, last.y);
        after();
      }
    };
    void document.fonts.ready.then(() => alive && (raf = requestAnimationFrame(step)));

    skip.onclick = finish;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (alive) finish();
    };
  }, [on]);

  if (!on) return null;
  // Over everything, the nav bar too: straight on the page, outside the hero's own layer.
  return createPortal(
    <div ref={root} className={`si ${archivo.variable}`} aria-hidden>
      <div className="si-flip" />
      <div className="si-words">
        {WORDS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="si-dot" />
      <div className="si-flood" />
      {/* eslint-disable-next-line @next/next/no-img-element -- the logo is swapped white to black by a filter while it moves; a plain img keeps its box exact */}
      <img className="si-logo" src="/brand/logo-white.png" alt="" width={611} height={161} />
      <button type="button" className="si-skip" tabIndex={0}>
        Skip
      </button>
    </div>,
    document.body,
  );
}
