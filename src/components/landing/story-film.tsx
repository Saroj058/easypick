"use client";

import { Archivo } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { HeroMosaic, type MosaicPiece } from "./hero-mosaic";
import "./story-film.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

/** Set once the film has started: it plays once per visit (until the tab or window is closed). */
const SEEN = "ep-intro-seen";
const MARK = "/brand/mark-white.png";
const NAME = "EASYPICK".split("");

type Scene = {
  lines?: string;
  wide?: boolean;
  small?: boolean;
  quote?: string;
  stack?: string;
  line?: string;
  logo?: boolean;
  cards?: boolean;
  nos?: string[];
  hold?: number;
  fin?: boolean;
};

// The story, in the owner's words. *word* is a key word (bold, underlined as it lands); ~word~ is quiet.
const SCENES: Scene[] = [
  { lines: "Shopping shouldn't feel like *negotiation.*", hold: 1600 },
  { lines: "You find something you *love.*", hold: 1100 },
  { lines: "Then comes the guessing, the bargaining, and the awkward question:", small: true, quote: "“What's your best price?”", hold: 2200 },
  { lines: "We thought there had to be a *better* *way.*", hold: 1400 },
  { lines: "A way to shop *freely,*", hold: 900 },
  { stack: "Fair", line: "knowing the price is fair,", hold: 900 },
  { stack: "Simple", line: "the process is simple,", hold: 900 },
  { stack: "Yours", line: "and the choice is always yours.", hold: 1100 },
  { lines: "So we built", logo: true, hold: 1800 },
  { lines: "A new kind of clothing store where prices are *fixed,* checkout is *automated,* and shopping feels the way it *should.*", wide: true, cards: true, hold: 2400 },
  { nos: ["bargaining.", "hidden games.", "unnecessary hassle."], hold: 1400 },
  { lines: "Just great style, *transparent* prices, and the *freedom* to shop your way — online or in-store.", wide: true, small: true, hold: 2000 },
  { lines: "Because buying clothes should be about *finding* *what* *you* *love,* ~not~ ~negotiating~ ~what~ ~you~ ~pay.~", wide: true, hold: 2400 },
  { fin: true },
];

// A few store labels where the story needs a picture (owner, 28 Oct 2026: "make it professional").
const FX: Record<number, string> = {
  0: `<div class="e txt" style="left:10%;top:24%;--d:.7s">Rs 2,500?</div><div class="e txt r" style="right:10%;bottom:26%;--d:1.1s">Final price, Rs 1,800?</div>`,
  5: `<div class="e chip" style="right:11%;top:22%;--d:.5s">Rs 1,999 · fixed price</div>`,
  6: `<div class="e chip" style="left:11%;top:22%;--d:.5s">Size → Buy now → eSewa</div>`,
  7: `<div class="e chip" style="right:11%;bottom:22%;--d:.5s">Your size · M · saved</div>`,
  11: `<div class="e chip" style="left:12%;top:22%;--d:.6s">Online</div><div class="e chip" style="right:12%;top:30%;--d:.9s">In-store</div><div class="e chip" style="left:50%;bottom:20%;margin-left:-60px;--d:1.2s">Same price</div>`,
};

const CARDS = `<div class="sf-cards" aria-hidden="true">
  <div class="sf-card sf-c1"><div class="mono">Everyday Hoodie</div><b>Rs 1,999</b><span class="pill">FIXED PRICE</span></div>
  <div class="sf-card sf-c2"><div class="mono">Checkout</div><b>Paid ✓</b><div class="mono" style="margin-top:6px">with eSewa · no account</div></div>
  <div class="sf-card sf-c3"><div class="mono">Your size</div><b>M · 122 cm</b></div>
  <div class="sf-card sf-c4"><div class="mono">Online or in-store</div><b>Same price</b></div></div>`;

/** What the voice reads in each scene. */
const spoken = (s: Scene) =>
  s.fin
    ? "Pick it. Pay it. Wear it. Easypick."
    : s.nos
      ? s.nos.map((n) => `No ${n}`).join(" ")
      : s.stack
        ? (s.line ?? "")
        : [s.lines, s.quote, s.logo ? "Easypick." : ""].filter(Boolean).join(" ").replace(/[*~“”]/g, "");

const words = (text: string) =>
  text
    .split(" ")
    .map((t) => `<span class="sf-w${t.startsWith("*") ? " key" : ""}${t.startsWith("~") ? " mute" : ""}">${t.replace(/[*~]/g, "")}</span>`)
    .join("");

function build(s: Scene, i: number) {
  const el = document.createElement("div");
  el.className = "sf-scene";
  let h = "<div>";
  if (s.lines) h += `<div class="sf-lines${s.wide ? " wide" : ""}${s.small ? " small" : ""}">${words(s.lines)}</div>`;
  if (s.quote) h += `<div class="sf-bubble">${s.quote}</div>`;
  if (s.stack) h += `<div class="sf-stack">${[0, 1, 2, 3, 4].map((k) => `<span class="${k === 2 ? "fill" : ""}">${s.stack}</span>`).join("")}</div><div class="sf-stack-line">${s.line}</div>`;
  if (s.logo) h += `<div class="sf-logo"><span class="b"><img src="${MARK}" alt=""></span><span class="t">${NAME.map((c) => `<span>${c}</span>`).join("")}</span></div>`;
  if (s.nos) h += `<div class="sf-nos">${s.nos.map((n) => `<div><b>No</b> ${n}</div>`).join("")}</div>`;
  h += "</div>";
  if (FX[i]) h += `<div class="sf-fx" aria-hidden="true">${FX[i]}</div>`;
  if (s.cards) h += CARDS;
  el.innerHTML = h;
  return el;
}

const FIN = `<div class="sf-fin-flip"></div>
  <div class="sf-fin-words" aria-hidden="true"><span>Pick it.</span><span>Pay it.</span><span>Wear it.</span></div>
  <div class="sf-fin-dot" aria-hidden="true"></div><div class="sf-fin-flood"></div>
  <div class="sf-fin-name" aria-hidden="true"><span class="sf-fin-badge"><img src="${MARK}" alt=""></span><span class="sf-fin-letters">${NAME.map((c) => `<span>${c}</span>`).join("")}</span></div>
  <div class="sf-fin-sub">Men's streetwear · Kathmandu</div>`;

// What the store promises, either side of the cards at the end (only what the store already does).
const SIDE_L = [
  { no: "01", title: "Fixed prices", line: "The price on the tag is the price. No bargaining." },
  { no: "02", title: "Your size in cm", line: "Every piece measured, so you know it fits." },
];
const SIDE_R = [
  { no: "03", title: "Pay with eSewa", line: "Buy now, pay, done. No account needed." },
  { no: "04", title: "Same price, everywhere", line: "Online or in the store. 7-day size swap." },
];

/** One side of the end screen: the promises in full on a wide screen, as one line up the edge on a phone. */
function Side({ side, items }: { side: "l" | "r"; items: typeof SIDE_L }) {
  return (
    <aside className={`sf-side ${side}`}>
      {items.map((x) => (
        <div key={x.no} className="sf-side-item">
          <span className="sf-side-no">{x.no}</span>
          <b>{x.title}</b>
          <span className="sf-side-line">{x.line}</span>
        </div>
      ))}
      <span className="sf-side-v" aria-hidden>
        {items.map((x) => x.title).join("  ·  ")}
      </span>
    </aside>
  );
}

/** A man reading the story, with the most natural male English voice the device has. Off until asked for. */
function makeVoice() {
  let on = false;
  let pick: SpeechSynthesisVoice | null = null;
  const can = typeof window !== "undefined" && "speechSynthesis" in window;
  const MALE = /(guy|andrew|brian|christopher|eric|davis|roger|steffan|ryan|thomas|daniel|alex|fred|aaron|arthur|oliver|google uk english male|male|david|mark|james|george)/i;
  const FEMALE = /female|zira|aria|jenny|sonia|libby|samantha|karen|victoria|susan|hazel/i;
  const choose = () => {
    const score = (v: SpeechSynthesisVoice) => (/natural|online|neural|premium|enhanced/i.test(v.name) ? 4 : 0) + (MALE.test(v.name) ? 3 : 0) + (/en-(gb|in)/i.test(v.lang) ? 1 : 0) - (FEMALE.test(v.name) ? 6 : 0);
    pick = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)).sort((a, b) => score(b) - score(a))[0] ?? null;
  };
  if (can) {
    choose();
    speechSynthesis.addEventListener("voiceschanged", choose);
  }
  return {
    get on() {
      return on;
    },
    toggle() {
      on = !on && can;
      if (!on && can) speechSynthesis.cancel();
      return on;
    },
    /** Reads a line; resolves when it is done (or at once when the voice is off). */
    say(text: string) {
      return new Promise<void>((done) => {
        if (!on || !text) return done();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (pick) u.voice = pick;
        u.rate = 1.05;
        u.pitch = 0.9;
        u.onend = u.onerror = () => done();
        speechSynthesis.speak(u);
      });
    },
    stop() {
      if (can) speechSynthesis.cancel();
    },
    dispose() {
      if (!can) return;
      speechSynthesis.cancel();
      speechSynthesis.removeEventListener("voiceschanged", choose);
    },
  };
}

/** Sound made in the page (no files): a soft hum, a tick per word, a chime per key word, a whoosh between scenes. */
function makeSfx() {
  let ac: AudioContext | null = null;
  let out: GainNode | null = null;
  let pad: GainNode | null = null;
  let on = false;
  const env = (g: GainNode, t: number, a: number, peak: number, d: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const tone = (freq: number, type: OscillatorType, peak: number, a: number, d: number, when = 0) => {
    if (!on || !ac || !out) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    env(g, t, a, peak, d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + a + d + 0.05);
  };
  const noise = (dur: number, peak: number, f0: number, f1: number, q = 1) => {
    if (!on || !ac || !out) return;
    const t = ac.currentTime;
    const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = b;
    f.type = "bandpass";
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, dur * 0.3, peak, dur * 0.7);
    src.connect(f).connect(g).connect(out);
    src.start(t);
  };
  // Two soft, slightly detuned tones and a fifth, through a slowly breathing filter.
  const startPad = (ac: AudioContext, out: GainNode) => {
    const f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    f.type = "lowpass";
    f.frequency.value = 700;
    lfo.frequency.value = 0.07;
    lg.gain.value = 300;
    lfo.connect(lg).connect(f.frequency);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 3);
    [110, 110.6, 164.8].forEach((fr) => {
      const o = ac.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = fr;
      o.connect(f);
      o.start();
    });
    f.connect(g).connect(out);
    lfo.start();
    return g;
  };
  return {
    toggle() {
      if (!ac) {
        ac = new AudioContext();
        out = ac.createGain();
        out.gain.value = 0.9;
        out.connect(ac.destination);
      }
      on = !on;
      if (on) {
        void ac.resume();
        if (!pad) pad = startPad(ac, out!);
        else pad.gain.setTargetAtTime(0.05, ac.currentTime, 0.5);
      } else pad?.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2);
      return on;
    },
    word: () => tone(1800 + Math.random() * 400, "sine", 0.025, 0.002, 0.05),
    key: () => [880, 1320, 1760].forEach((fr, i) => tone(fr, "sine", 0.07 / (i + 1), 0.005, 1.1, i * 0.015)),
    whoosh: () => noise(0.7, 0.06, 300, 2400, 0.8),
    thud: () => {
      tone(70, "sine", 0.35, 0.005, 0.35);
      noise(0.12, 0.05, 900, 300, 2);
    },
    swipe: () => noise(0.35, 0.08, 3000, 900, 2),
    tick: () => tone(520, "triangle", 0.05, 0.003, 0.12),
    pop: () => {
      tone(660, "sine", 0.1, 0.004, 0.25);
      tone(990, "sine", 0.05, 0.004, 0.3, 0.04);
    },
    chord: () => [261.6, 329.6, 392, 523.3].forEach((fr, i) => tone(fr, "triangle", 0.07, 0.02, 2.4, i * 0.06)),
    dispose() {
      void ac?.close();
    },
  };
}

/**
 * The top of the home page (owner, 28 Oct 2026, after a Pinterest reference and the brand's own story): the story
 * told one line at a time on white, key words underlined as they land, big repeated words, a few store labels and
 * cards; then the dot ending: PICK IT. PAY IT. WEAR IT., the black flood, EASYPICK, the logo. Once it has ended,
 * the end screen: the words, the logo and Shop now on top, and the pieces below in a collage of cards that turn
 * over at random (owner, 28 Oct 2026).
 * Sound and a man's voice are there on a tap (browsers start them muted). It plays once per visit; after that, and
 * for people who ask for less motion, the logo shows straight away, with Replay.
 */
export function StoryFilm({ pieces }: { pieces: MosaicPiece[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const film = root.current;
    if (!film) return;
    const $ = <T extends HTMLElement>(s: string) => film.querySelector(s) as T;
    const host = $(".sf-scenes"), fin = $(".sf-fin"), bar = $(".sf-bar i");
    const skipFill = $(".sf-skip-fill");
    const btn = {
      skip: $<HTMLButtonElement>("[data-sf=skip]"),
      sound: $<HTMLButtonElement>("[data-sf=sound]"),
      voiceBtn: $<HTMLButtonElement>("[data-sf=voice]"),
      pause: $<HTMLButtonElement>("[data-sf=pause]"),
      replay: $<HTMLButtonElement>("[data-sf=replay]"),
    };
    const voice = makeVoice();
    const sfx = makeSfx();
    let timers: number[] = [];
    let anims: Animation[] = [];
    let finRaf = 0, barRaf = 0;
    let at = 0, paused = false, startT = 0, elapsed = 0;
    let alive = true;
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const go = (el: Element, keys: Keyframe[], opts: KeyframeAnimationOptions) => {
      const a = el.animate(keys, { fill: "forwards", ...opts });
      anims.push(a);
      return a;
    };

    // Which buttons show: while it plays, Sound, Voice, Pause and Skip; once it has ended, Replay.
    const mode = (playing: boolean) => {
      film.classList.toggle("sf-done", !playing);
      setDone(!playing);
      // Sound and Voice belong to the story: once it has ended they go, and the hum fades out.
      if (!playing && btn.sound.getAttribute("aria-pressed") === "true") btn.sound.click();
      btn.sound.hidden = btn.voiceBtn.hidden = !playing;
      btn.skip.hidden = btn.pause.hidden = !playing;
      btn.replay.hidden = playing;
    };

    const TOTAL = 40000;
    const tickBar = () => {
      if (!paused) {
        const p = Math.min(1, (performance.now() - startT + elapsed) / TOTAL);
        bar.style.width = `${p * 100}%`;
        skipFill.style.transform = `scaleX(${p})`;
      }
      barRaf = requestAnimationFrame(tickBar);
    };

    const show = (i: number) => {
      if (!alive) return;
      const s = SCENES[i];
      const old = host.querySelector(".sf-scene.on");
      if (old) {
        old.classList.replace("on", "off");
        window.setTimeout(() => old.remove(), 700);
      }
      sfx.whoosh();
      at = i;
      if (s.fin) return finale();
      const el = build(s, i);
      host.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on")));
      let t = 250;
      // Words arrive one by one; a key word's line draws under it just after it lands.
      el.querySelectorAll<HTMLElement>(".sf-w").forEach((w) => {
        const key = w.classList.contains("key");
        later(t, () => {
          w.classList.add("on");
          if (key)
            later(260, () => {
              w.classList.add("lit");
              sfx.key();
            });
          else sfx.word();
        });
        t += key ? 330 : 80;
      });
      const q = el.querySelector(".sf-bubble");
      if (q) {
        t += 200;
        later(t, () => {
          q.classList.add("on");
          sfx.thud();
        });
        t += 1100;
        later(t, () => {
          q.classList.add("struck");
          sfx.swipe();
        });
        t += 500;
      }
      const st = el.querySelectorAll(".sf-stack span");
      st.forEach((x, k) =>
        later(t + k * 90, () => {
          x.classList.add("on");
          sfx.tick();
        }),
      );
      if (st.length) {
        t += 600;
        later(t, () => el.querySelector(".sf-stack-line")?.classList.add("on"));
      }
      const logo = el.querySelector(".sf-logo");
      if (logo) {
        t += 200;
        later(t, () => {
          logo.classList.add("on");
          sfx.pop();
        });
        el.querySelectorAll<HTMLElement>(".sf-logo .t span").forEach((x, k) => (x.style.transitionDelay = `${300 + k * 60}ms`));
        t += 900;
      }
      el.querySelectorAll(".sf-card").forEach((c, k) =>
        later(t * 0.4 + k * 350, () => {
          c.classList.add("on");
          sfx.pop();
        }),
      );
      el.querySelectorAll(".sf-nos div").forEach((d) => {
        later(t, () => {
          d.classList.add("on");
          sfx.thud();
        });
        t += 450;
      });
      // On to the next scene once its moment has played and the voice has finished its line.
      let timeUp = false, said = false;
      const next = () => timeUp && said && !paused && show(i + 1);
      later(t + (s.hold ?? 1000) * 0.7, () => {
        timeUp = true;
        next();
      });
      void voice.say(spoken(s)).then(() => {
        said = true;
        later(300, next);
      });
    };

    // The ending: the dot bounces and stamps PICK IT. PAY IT. WEAR IT., the ground flipping black and white out from
    // each impact; it floods the screen black, EASYPICK types in white, and the black shrinks into the logo's badge.
    const finale = () => {
      btn.pause.hidden = true;
      fin.hidden = false;
      fin.innerHTML = FIN;
      film.classList.add("sf-fin-on");
      requestAnimationFrame(() => fin.classList.add("on"));
      void voice.say(spoken(SCENES[SCENES.length - 1]));
      const q = <T extends HTMLElement>(c: string) => fin.querySelector(c) as T;
      const dot = q(".sf-fin-dot"), flip = q(".sf-fin-flip"), flood = q(".sf-fin-flood"), nameEl = q(".sf-fin-name"), badge = q(".sf-fin-badge"), wordsEl = q(".sf-fin-words");
      const ws = [...wordsEl.children] as HTMLElement[];
      const letters = [...fin.querySelectorAll<HTMLElement>(".sf-fin-letters span")];
      const T = (x: number, y: number, r = 0, sx = 1, sy = 1) => `translate(${x}px, ${y}px) rotate(${r}rad) scale(${sx}, ${sy})`;
      const C = (rad: number, x: number, y: number) => `circle(${rad}px at ${x}px ${y}px)`;
      const W = fin.clientWidth, H = fin.clientHeight, R = Math.hypot(W, H), box = fin.getBoundingClientRect();
      const small = W <= 640, r0 = small ? 10 : 13;
      // Where each word sits (its layout, not its stamped-in transform); on a phone the dot lands just after each word.
      const wb = wordsEl.getBoundingClientRect();
      const spots = ws.map((w) =>
        small
          ? { x: wb.left - box.left + w.offsetLeft + w.offsetWidth + r0 + 8, y: wb.top - box.top + w.offsetTop + w.offsetHeight * 0.62 }
          : { x: wb.left - box.left + w.offsetLeft + w.offsetWidth / 2, y: wb.top - box.top + w.offsetTop + w.offsetHeight * 0.1 - r0 },
      );
      const last = spots[spots.length - 1];
      // One gravity: a fall, a bounce to each word, a small hop to settle.
      const G = 2600, hop = small ? Math.min(90, H * 0.12) : Math.min(150, H * 0.2);
      const start = small ? { x: spots[0].x + 40, y: -30 } : { x: spots[0].x - Math.min(260, W * 0.25), y: -30 };
      const legs = [{ a: start, b: spots[0], h: 0, ms: Math.sqrt((2 * (spots[0].y - start.y)) / G) * 1000, land: 0 }];
      for (let i = 1; i < spots.length; i++) legs.push({ a: spots[i - 1], b: spots[i], h: i === spots.length - 1 ? hop * 0.8 : hop, ms: 2 * Math.sqrt((2 * hop) / G) * 1000, land: i });
      legs.push({ a: last, b: last, h: 16, ms: 2 * Math.sqrt(32 / G) * 1000, land: -1 });
      let dark = false;
      const land = (p: { x: number; y: number }, i: number) => {
        ws[i].classList.add("on");
        sfx.thud();
        go(flip, dark ? [{ clipPath: C(R, p.x, p.y) }, { clipPath: C(0, p.x, p.y) }] : [{ clipPath: C(0, p.x, p.y) }, { clipPath: C(R, p.x, p.y) }], { duration: 480, easing: "cubic-bezier(.4,0,.2,1)" });
        dark = !dark;
        const rp = document.createElement("span");
        rp.className = "sf-fin-ripple";
        rp.style.left = `${p.x}px`;
        rp.style.top = `${p.y + r0}px`;
        fin.appendChild(rp);
        window.setTimeout(() => rp.remove(), 700);
      };
      const after = () => {
        later(360, () => {
          wordsEl.classList.add("out");
          if (dark) {
            go(flip, [{ clipPath: C(R, last.x, last.y) }, { clipPath: C(0, last.x, last.y) }], { duration: 420, easing: "cubic-bezier(.4,0,.2,1)" });
            dark = false;
          }
          go(dot, [{ transform: T(last.x, last.y) }, { transform: T(W / 2, H / 2) }], { duration: 400, easing: "cubic-bezier(.65,0,.35,1)" });
        });
        later(760, () => {
          dot.style.opacity = "0";
          sfx.whoosh();
          go(flood, [{ clipPath: C(r0, W / 2, H / 2) }, { clipPath: C(R, W / 2, H / 2) }], { duration: 560, easing: "cubic-bezier(.7,0,.15,1)" });
        });
        letters.forEach((l, i) =>
          later(1110 + i * 70 + (i >= 4 ? 40 : 0), () => {
            l.classList.add("on");
            sfx.word();
          }),
        );
        const back = 1110 + letters.length * 70 + 40 + 380;
        later(back, () => {
          nameEl.classList.add("ink");
          const b = badge.getBoundingClientRect();
          go(flood, [{ clipPath: C(R, W / 2, H / 2) }, { clipPath: C(b.width / 2, b.left - box.left + b.width / 2, b.top - box.top + b.height / 2) }], { duration: 760, easing: "cubic-bezier(.76,0,.24,1)" })
            .finished.then(() => {
              if (!alive) return;
              badge.classList.add("on");
              flood.getAnimations().forEach((a) => a.cancel());
              requestAnimationFrame(() => badge.classList.add("mark"));
              sfx.chord();
            })
            .catch(() => {});
        });
        later(back + 1300, () => {
          q(".sf-fin-sub").classList.add("on");
          bar.style.width = "100%";
          paused = true;
          mode(false);
        });
      };
      let leg = 0, t0 = performance.now() + 500, holdTo = t0;
      const step = (now: number) => {
        if (now < holdTo) {
          finRaf = requestAnimationFrame(step);
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
          finRaf = requestAnimationFrame(step);
          return;
        }
        dot.style.transform = T(L.b.x, L.b.y + r0 * 0.3, 0, 1.32, 0.7);
        if (L.land >= 0) land(L.b, L.land);
        if (++leg < legs.length) {
          holdTo = t0 = now + 70;
          finRaf = requestAnimationFrame(step);
        } else {
          dot.style.transform = T(last.x, last.y);
          after();
        }
      };
      finRaf = requestAnimationFrame(step);
    };

    const stop = () => {
      timers.forEach(clearTimeout);
      timers = [];
      cancelAnimationFrame(finRaf);
      anims.forEach((a) => a.cancel());
      anims = [];
      voice.stop();
      fin.classList.remove("on");
      fin.hidden = true;
      fin.innerHTML = "";
      film.classList.remove("sf-fin-on");
      host.innerHTML = "";
    };

    // The end, without the film: the logo and its line, as the ending leaves them.
    const still = () => {
      stop();
      fin.innerHTML = FIN;
      fin.hidden = false;
      film.classList.add("sf-fin-on");
      fin.querySelector(".sf-fin-words")?.classList.add("out");
      fin.querySelector<HTMLElement>(".sf-fin-dot")!.style.opacity = "0";
      fin.querySelector(".sf-fin-name")?.classList.add("ink");
      fin.querySelectorAll(".sf-fin-letters span, .sf-fin-sub").forEach((x) => x.classList.add("on"));
      fin.querySelector(".sf-fin-badge")?.classList.add("on", "mark");
      fin.classList.add("on");
      paused = true;
      bar.style.width = "100%";
      mode(false);
    };

    const play = () => {
      stop();
      paused = false;
      btn.pause.textContent = "Pause";
      startT = performance.now();
      elapsed = 0;
      mode(true);
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {
        /* private mode: it simply plays again next time */
      }
      show(0);
    };

    btn.skip.onclick = still;
    btn.replay.onclick = play;
    btn.voiceBtn.onclick = () => {
      const on = voice.toggle();
      btn.voiceBtn.textContent = on ? "Voice off" : "Voice on";
      btn.voiceBtn.setAttribute("aria-pressed", String(on));
      if (on) play();
    };
    btn.sound.onclick = () => {
      const on = sfx.toggle();
      btn.sound.textContent = on ? "Sound off" : "Sound on";
      btn.sound.setAttribute("aria-pressed", String(on));
    };
    // Pause stops the clock between scenes (the current scene finishes its words).
    btn.pause.onclick = () => {
      paused = !paused;
      btn.pause.textContent = paused ? "Play" : "Pause";
      if (paused) {
        timers.forEach(clearTimeout);
        timers = [];
        elapsed += performance.now() - startT;
        voice.stop();
      } else {
        startT = performance.now();
        show(at + 1 < SCENES.length ? at + 1 : at);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !btn.skip.hidden && still();
    window.addEventListener("keydown", onKey);

    let seen = false;
    try {
      seen = !!sessionStorage.getItem(SEEN);
    } catch {
      /* private mode */
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    barRaf = requestAnimationFrame(tickBar);
    // Start only once the fonts are in, so the dot lands on the real words.
    void document.fonts.ready.then(() => {
      if (!alive) return;
      if (seen || reduced) still();
      else later(300, play);
    });
    return () => {
      alive = false;
      stop();
      cancelAnimationFrame(barRaf);
      window.removeEventListener("keydown", onKey);
      voice.dispose();
      sfx.dispose();
    };
  }, []);

  return (
    <div ref={root} className={`sf ${archivo.variable}`}>
      <h1 id="landing-title" className="sr-only">
        Easypick: men&apos;s streetwear in Kathmandu. Fixed prices, no bargaining.
      </h1>
      <div className="sf-glow" aria-hidden>
        <i />
        <i />
      </div>
      <div className="sf-ring" aria-hidden />
      <div className="sf-deco" aria-hidden>
        <i className="sf-ci sf-d1" />
        <i className="sf-ci sf-d2" />
        <i className="sf-dots sf-d3" />
      </div>
      <div className="sf-scenes" aria-hidden />
      <div className="sf-fin" hidden />
      {/* The end: the logo and Shop now on top; the pieces below, turning over at random, with what the store
          promises on either side */}
      <div className="sf-end">
        <div className="sf-end-top">
          <div className="sf-end-name" aria-hidden>
            <span className="sf-end-badge">
              <Image src={MARK} alt="" width={146} height={148} />
            </span>
            EASYPICK
          </div>
          <p className="sf-end-sub">Men&apos;s streetwear · Kathmandu</p>
          <Link href="/shop" className="sf-shop">
            Shop now
          </Link>
        </div>
        <div className="sf-end-body">
          <Side side="l" items={SIDE_L} />
          <HeroMosaic pieces={pieces} play={done} />
          <Side side="r" items={SIDE_R} />
        </div>
      </div>
      <div className="sf-bar" aria-hidden>
        <i />
      </div>
      {/* Skip: a black block at the top, its arrow in its own box, a line along its foot filling as the film plays */}
      <button type="button" data-sf="skip" className="sf-skip">
        <span className="sf-skip-label">Skip the story</span>
        <span className="sf-skip-arrow" aria-hidden>
          <i>→</i>
        </span>
        <span className="sf-skip-fill" aria-hidden />
      </button>
      <div className="sf-ctl">
        <button type="button" data-sf="sound" aria-pressed="false">
          Sound on
        </button>
        <button type="button" data-sf="voice" aria-pressed="false">
          Voice on
        </button>
        <button type="button" data-sf="pause">
          Pause
        </button>
        <button type="button" data-sf="replay" hidden>
          Replay
        </button>
      </div>
    </div>
  );
}
