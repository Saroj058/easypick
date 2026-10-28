"use client";

import { Archivo } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import "./dot-intro.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

/** Set once the intro has played: it plays once per visit (until the tab or window is closed). */
const SEEN = "ep-intro-seen";
const WORDS = ["Pick it.", "Pay it.", "Wear it."];
const NAME = "EASYPICK".split("");

/**
 * The top of the home page (owner, 28 Oct 2026, after a Pinterest reference: "that dot is better, put it in
 * the system"). A dot bounces and stamps PICK IT. PAY IT. WEAR IT., the ground flipping black and white out
 * from each impact; the dot floods the screen black, EASYPICK types in white, the black shrinks into the logo's
 * round badge, and the page settles on its first screen: the logo, one line, Shop now, the promises. Black and
 * white only, no pictures. It plays once per visit; after that, and for people who ask for less motion, the
 * first screen shows straight away. Skip ends it at any time.
 */
export function DotIntro() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = root.current;
    if (!stage) return;
    const $ = <T extends HTMLElement>(s: string) => stage.querySelector(s) as T;
    const dot = $(".di-dot"), flip = $(".di-flip"), flood = $(".di-flood"), nameEl = $(".di-name"), badge = $(".di-badge");
    const wordsEl = $(".di-words"), finalEl = $(".di-final"), slot = $(".di-slot"), skip = $<HTMLButtonElement>(".di-skip");
    const words = [...wordsEl.children] as HTMLElement[];
    const letters = [...stage.querySelectorAll<HTMLElement>(".di-letters span")];
    let timers: number[] = [];
    let anims: Animation[] = [];
    let raf = 0;
    let dark = false;
    let alive = true;
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const go = (el: Element, keys: Keyframe[], opts: KeyframeAnimationOptions) => {
      const a = el.animate(keys, { fill: "forwards", ...opts });
      anims.push(a);
      return a;
    };
    const T = (x: number, y: number, r = 0, sx = 1, sy = 1) => `translate(${x}px, ${y}px) rotate(${r}rad) scale(${sx}, ${sy})`;
    const C = (rad: number, x: number, y: number) => `circle(${rad}px at ${x}px ${y}px)`;

    const stop = () => {
      timers.forEach(clearTimeout);
      timers = [];
      cancelAnimationFrame(raf);
      anims.forEach((a) => a.cancel());
      anims = [];
      stage.querySelectorAll(".di-ripple").forEach((r) => r.remove());
    };

    // The first screen: the name flies to its place at the top, then the rest arrives.
    const settle = (now: boolean) => {
      stop();
      stage.classList.remove("di-playing");
      dot.style.opacity = "0";
      wordsEl.classList.add("di-out");
      letters.forEach((l) => l.classList.add("di-on"));
      badge.classList.add("di-on", "di-mark");
      nameEl.classList.add("di-ink");
      nameEl.style.transform = "";
      const n = nameEl.getBoundingClientRect(), s = slot.getBoundingClientRect();
      const k = s.height / n.height, dx = s.left + s.width / 2 - (n.left + n.width / 2), dy = s.top + s.height / 2 - (n.top + n.height / 2);
      const to = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${k})`;
      if (now) nameEl.style.transform = to;
      else go(nameEl, [{ transform: "translate(-50%, -50%)" }, { transform: to }], { duration: 750, easing: "cubic-bezier(.65,0,.35,1)" }).finished.then(() => alive && (nameEl.style.transform = to)).catch(() => {});
      if (now) finalEl.classList.add("di-on");
      else at(300, () => finalEl.classList.add("di-on"));
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {
        /* private mode: it simply plays again next time */
      }
    };

    const play = () => {
      stage.classList.add("di-playing");
      const W = stage.clientWidth, H = stage.clientHeight, R = Math.hypot(W, H), box = stage.getBoundingClientRect();
      const small = W <= 600;
      const r0 = small ? 10 : 13;
      // Where each word sits (from its layout, not its stamped-in transform, which starts small). On a phone the
      // words stack, so the dot lands just after each one (like its full stop) and its path stays clear of the text.
      const wb = wordsEl.getBoundingClientRect();
      const spots = words.map((w) =>
        small
          ? { x: wb.left - box.left + w.offsetLeft + w.offsetWidth + r0 + 8, y: wb.top - box.top + w.offsetTop + w.offsetHeight * 0.62 }
          : { x: wb.left - box.left + w.offsetLeft + w.offsetWidth / 2, y: wb.top - box.top + w.offsetTop + w.offsetHeight * 0.1 - r0 },
      );
      const last = spots[spots.length - 1];
      // The legs, all at one gravity: a fall, a bounce to each word, and a small hop to settle.
      const G = 2600, hop = small ? Math.min(90, H * 0.12) : Math.min(150, H * 0.2);
      const start = small ? { x: spots[0].x + 40, y: -30 } : { x: spots[0].x - Math.min(260, W * 0.25), y: -30 };
      const legs = [{ a: start, b: spots[0], h: 0, ms: Math.sqrt((2 * (spots[0].y - start.y)) / G) * 1000, land: 0 }];
      for (let i = 1; i < spots.length; i++) legs.push({ a: spots[i - 1], b: spots[i], h: i === spots.length - 1 ? hop * 0.8 : hop, ms: 2 * Math.sqrt((2 * hop) / G) * 1000, land: i });
      legs.push({ a: last, b: last, h: 16, ms: 2 * Math.sqrt(32 / G) * 1000, land: -1 });

      const land = (s: { x: number; y: number }, i: number) => {
        words[i].classList.add("di-on");
        // The ground flips out from the impact (and back in towards it).
        go(flip, dark ? [{ clipPath: C(R, s.x, s.y) }, { clipPath: C(0, s.x, s.y) }] : [{ clipPath: C(0, s.x, s.y) }, { clipPath: C(R, s.x, s.y) }], { duration: 480, easing: "cubic-bezier(.4,0,.2,1)" });
        dark = !dark;
        const rp = document.createElement("span");
        rp.className = "di-ripple";
        rp.style.left = `${s.x}px`;
        rp.style.top = `${s.y + r0}px`;
        stage.appendChild(rp);
        window.setTimeout(() => rp.remove(), 700);
      };

      let leg = 0, t0 = performance.now(), holdTo = 0;
      const step = (now: number) => {
        if (now < holdTo) {
          raf = requestAnimationFrame(step);
          return;
        }
        const L = legs[leg], t = Math.min(1, (now - t0) / L.ms);
        const fall = leg === 0;
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
          after(W, H, R, last, box);
        }
      };
      raf = requestAnimationFrame(step);
    };

    // After the bounce: a beat to read, then the words go and the dot glides to the middle and floods the screen black.
    const after = (W: number, H: number, R: number, last: { x: number; y: number }, box: DOMRect) => {
      at(360, () => {
        wordsEl.classList.add("di-out");
        if (dark) {
          go(flip, [{ clipPath: C(R, last.x, last.y) }, { clipPath: C(0, last.x, last.y) }], { duration: 420, easing: "cubic-bezier(.4,0,.2,1)" });
          dark = false;
        }
        go(dot, [{ transform: T(last.x, last.y) }, { transform: T(W / 2, H / 2) }], { duration: 400, easing: "cubic-bezier(.65,0,.35,1)" });
      });
      at(760, () => {
        dot.style.opacity = "0";
        go(flood, [{ clipPath: C(13, W / 2, H / 2) }, { clipPath: C(R, W / 2, H / 2) }], { duration: 560, easing: "cubic-bezier(.7,0,.15,1)" });
      });
      // EASYPICK types in, white on the black, a beat between EASY and PICK.
      letters.forEach((l, i) => at(1110 + i * 70 + (i >= 4 ? 40 : 0), () => l.classList.add("di-on")));
      const back = 1110 + letters.length * 70 + 40 + 380;
      // The black shrinks exactly onto the logo's badge as the name turns black; the mark spins in.
      at(back, () => {
        nameEl.classList.add("di-ink");
        const b = badge.getBoundingClientRect();
        go(flood, [{ clipPath: C(R, W / 2, H / 2) }, { clipPath: C(b.width / 2, b.left - box.left + b.width / 2, b.top - box.top + b.height / 2) }], { duration: 760, easing: "cubic-bezier(.76,0,.24,1)" })
          .finished.then(() => {
            if (!alive) return;
            badge.classList.add("di-on");
            flood.getAnimations().forEach((a) => a.cancel());
            requestAnimationFrame(() => badge.classList.add("di-mark"));
          })
          .catch(() => {});
      });
      at(back + 1000, () => settle(false));
    };

    skip.onclick = () => settle(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stage.classList.contains("di-playing") && settle(true);
    window.addEventListener("keydown", onKey);

    let seen = false;
    try {
      seen = !!sessionStorage.getItem(SEEN);
    } catch {
      /* private mode */
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Measure only once the fonts are in, so the dot lands on the real words.
    void document.fonts.ready.then(() => {
      if (!alive) return;
      if (seen || still) settle(true);
      else timers.push(window.setTimeout(play, 200));
    });
    // A resize after it has settled keeps the name in its place.
    const onResize = () => !stage.classList.contains("di-playing") && finalEl.classList.contains("di-on") && settle(true);
    window.addEventListener("resize", onResize);
    return () => {
      alive = false;
      stop();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={root} className={`di ${archivo.variable}`}>
      <div className="di-flip" aria-hidden />
      <div className="di-words" aria-hidden>
        {WORDS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="di-dot" aria-hidden />
      <div className="di-flood" aria-hidden />
      <h1 id="landing-title" className="di-name">
        <span className="sr-only">Easypick: men&apos;s streetwear in Kathmandu</span>
        <span className="di-badge" aria-hidden>
          <Image src="/brand/mark-white.png" alt="" width={146} height={148} priority />
        </span>
        <span className="di-letters" aria-hidden>
          {NAME.map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </span>
      </h1>
      <div className="di-final">
        <div className="di-head" />
        <span />
        <div className="di-slot" />
        <div className="di-cap di-fade">
          <span className="di-tag">Men&apos;s streetwear, Kathmandu</span>
          <span className="di-line">Fixed prices, your size in cm, pay with eSewa.</span>
        </div>
        <div className="di-cta di-fade di-d2">
          <Link href="/shop" className="di-btn">
            Shop now
          </Link>
          <Link href="/drops" className="di-link">
            See the drop
          </Link>
        </div>
        <span />
        <div className="di-promise di-fade di-d3">
          <span>Same price online and in store</span>
          <span>7-day size swap</span>
          <span>Next day in Kathmandu</span>
        </div>
      </div>
      <button type="button" className="di-skip">
        Skip
      </button>
    </div>
  );
}
