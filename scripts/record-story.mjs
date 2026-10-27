// The home hero's how-to films (public/story/video): the real site used start to finish, edited like a
// screen film. Run the test copy first (the e2e server on :3100 with NEXT_PUBLIC_SITE_URL pointing at
// it and payments in test mode; never the live site for anything that orders), then:
//   node scripts/record-story.mjs [name]
// The Vault film needs pieces: BASE=http://localhost:3301 for a read-only preview of the live data.
// The window is visible: at eSewa's login a person ticks "I'm not a robot" and presses LOGIN (it is
// never bypassed); that stretch is cut from the film.
//
// The edit: a camera that glides and zooms to each action, a drawn cursor with a ring on each click,
// a caption for every step ("03 / 08 · Pick your size"), jump cuts over loading, speed ramps (typing
// fast, clicks at life speed, captions held long enough to read), a title card and an end card.
// CDP screencast frames → frames edited with sharp → VP8 WebM through Playwright's own ffmpeg.
// Contact sheets (<name>-sheet.png) land in the current folder, to check each film by eye. Each film's
// steps and when they show (s) are printed, for its card's step list (src/app/page.tsx).
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
const sharp = createRequire(import.meta.url)("sharp");

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = new URL("../public/story/video", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FFMPEG = `${process.env.LOCALAPPDATA}/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe`;
const VW = 1280, VH = 800; // the page, in CSS px
const SCALE = 2; // captured at 2× so the zoom stays sharp
const OW = 1120, OH = 700; // the film
const FPS = 30;
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const now = () => Date.now() / 1000;
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SANS = "Inter,'Segoe UI','Helvetica Neue',Arial,sans-serif";
const MONO = "'JetBrains Mono',Consolas,Menlo,monospace";
const DIDONE = "'Bodoni Moda','Bodoni MT','Bodoni 72',Didot,Georgia,serif";
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);

// ---- The overlays (motion system) ----
const captionSvg = (n, N, label, a, dy) => {
  const w = Math.round(130 + label.length * 12.3);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OH}">
 <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${(0.42 * a).toFixed(3)}"/></linearGradient></defs>
 <rect x="0" y="480" width="${OW}" height="220" fill="url(#s)"/>
 <g transform="translate(40 ${(606 + dy).toFixed(1)})" opacity="${a.toFixed(3)}">
  <rect width="${w}" height="56" rx="4" fill="#0a0a0a" fill-opacity="0.9"/>
  <text x="20" y="34" font-family="${MONO}" font-size="12" letter-spacing="1.5" fill="#fff" fill-opacity="0.55">${String(n).padStart(2, "0")} / ${String(N).padStart(2, "0")}</text>
  <rect x="92" y="20" width="1" height="16" fill="#fff" fill-opacity="0.25"/>
  <text x="108" y="36" font-family="${SANS}" font-size="22" font-weight="600" fill="#fff">${esc(label)}</text>
 </g></svg>`);
};
const barSvg = (p) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="3"><rect width="${OW}" height="3" fill="#000" fill-opacity="0.12"/><rect width="${(OW * p).toFixed(1)}" height="3" fill="#111" fill-opacity="0.85"/></svg>`);
const introSvg = (title, a, dy, fade = 1) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OH}"><g opacity="${fade.toFixed(3)}"><rect width="${OW}" height="${OH}" fill="#0a0a0a"/>
 <g opacity="${a.toFixed(3)}" transform="translate(0 ${dy.toFixed(1)})">
  <text x="${OW / 2}" y="300" text-anchor="middle" font-family="${MONO}" font-size="12" letter-spacing="3" fill="#fff" fill-opacity="0.5">EASYPICK — HOW IT WORKS</text>
  <text x="${OW / 2}" y="372" text-anchor="middle" font-family="${DIDONE}" font-size="60" fill="#fff">${esc(title)}</text>
 </g></g></svg>`);
const endSvg = (title, sub, k) => {
  const d = 60;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OH}">
 <circle cx="${OW / 2}" cy="262" r="26" fill="#c8f169" opacity="${Math.min(1, k * 3).toFixed(3)}"/>
 <path d="M${OW / 2 - 11} 263 l8 8 l15 -16" fill="none" stroke="#0a0a0a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${d}" stroke-dashoffset="${(d * (1 - easeOut(Math.min(1, k * 2)))).toFixed(1)}"/>
 <text x="${OW / 2}" y="352" text-anchor="middle" font-family="${DIDONE}" font-size="54" fill="#fff" opacity="${Math.min(1, k * 2.5).toFixed(3)}">${esc(title)}</text>
 <text x="${OW / 2}" y="396" text-anchor="middle" font-family="${MONO}" font-size="13" letter-spacing="2" fill="#fff" fill-opacity="${(0.6 * Math.min(1, k * 2)).toFixed(3)}">${esc(sub.toUpperCase())}</text>
</svg>`);
};
const cursorSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42"><path d="M3 2 L3 32 L11 25 L17 39 L23 36 L17 23 L28 23 Z" fill="#111" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>`);
const ring = (r, a) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${2 * r + 8}" height="${2 * r + 8}"><circle cx="${r + 4}" cy="${r + 4}" r="${r}" fill="rgba(17,17,17,${(0.12 * a).toFixed(3)})" stroke="rgba(17,17,17,${(0.7 * a).toFixed(3)})" stroke-width="2.5"/></svg>`);

async function record(name, url, meta, act) {
  if (only && only !== name) return;
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: SCALE });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("ep-intro-seen", "1");
    } catch {}
    const st = document.createElement("style");
    st.textContent = "nextjs-portal{display:none!important}";
    const add = () => document.documentElement.appendChild(st);
    if (document.readyState === "loading") addEventListener("DOMContentLoaded", add);
    else add();
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(BASE + url, { waitUntil: "load", timeout: 240000 });
  await page.waitForTimeout(2500);

  // What the editor needs: the cursor, the actions, the captions and the cuts, each with its time.
  const cur = [{ t: now(), x: VW * 0.62, y: VH * 0.7 }];
  const events = []; // { t, x, y, kind, long? }
  const says = []; // { t, text }
  const cuts = []; // [from, to]
  let at = { x: VW * 0.62, y: VH * 0.7 };
  const glide = async (x, y, ms = 650) => {
    const n = Math.max(8, Math.round(ms / 16));
    const a = { ...at };
    for (let i = 1; i <= n; i++) {
      const e = ease(i / n);
      const px = a.x + (x - a.x) * e, py = a.y + (y - a.y) * e;
      await page.mouse.move(px, py);
      cur.push({ t: now(), x: px, y: py });
      await page.waitForTimeout(16);
    }
    at = { x, y };
  };
  const h = {
    page,
    pause: (ms) => page.waitForTimeout(ms),
    /** A caption for the next step: shown a beat before the action, until the next one. */
    say(text) {
      says.push({ t: now(), text });
    },
    cut: {
      from: () => cuts.push([now(), null]),
      async to() {
        cuts[cuts.length - 1][1] = now();
        // A still page sends no frames: nudge it so the film picks up right where the cut lands.
        await page.evaluate(() => window.scrollBy(0, 1)).catch(() => {});
        await page.waitForTimeout(120);
        await page.evaluate(() => window.scrollBy(0, -1)).catch(() => {});
      },
    },
    async click(loc, opts = {}) {
      await loc.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const b = await loc.boundingBox();
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      await glide(x, y, opts.ms ?? 700);
      await page.waitForTimeout(150);
      events.push({ t: now(), x, y, kind: "click" });
      await page.mouse.down();
      await page.waitForTimeout(90);
      await page.mouse.up();
      await page.waitForTimeout(opts.after ?? 450);
    },
    async type(loc, text) {
      await h.click(loc, { after: 200 });
      const b = await loc.boundingBox();
      events.push({ t: now(), x: b.x + Math.min(b.width / 2, 120), y: b.y + b.height / 2, kind: "type", long: text.length * 0.075 });
      await loc.pressSequentially(text, { delay: 75 });
      await page.waitForTimeout(350);
    },
    async drag(x0, y, x1) {
      await glide(x0, y, 600);
      events.push({ t: now(), x: (x0 + x1) / 2, y, kind: "drag" });
      await page.mouse.down();
      for (let i = 1; i <= 24; i++) {
        const px = x0 + ((x1 - x0) * i) / 24;
        await page.mouse.move(px, y);
        cur.push({ t: now(), x: px, y });
        await page.waitForTimeout(16);
      }
      at = { x: x1, y };
      await page.mouse.up();
      await page.waitForTimeout(700);
    },
    async scrollTo(sel, off = 80) {
      await page.evaluate(([s, o]) => {
        const el = document.querySelector(s);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - o, behavior: "smooth" });
      }, [sel, off]);
      await page.waitForTimeout(1200);
    },
    /** eSewa, start to finish: a cut to its page, the test account typed, the robot check by a person (cut), the token, confirm, a cut back to the result. */
    async esewa(done = "Paid. Your order is in") {
      h.cut.from();
      await page.waitForURL(/esewa/, { timeout: 90000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.getByPlaceholder("eSewa ID").waitFor({ timeout: 60000 });
      await page.waitForTimeout(600);
      await h.cut.to();
      await page.waitForTimeout(400);
      h.say("Log in to eSewa");
      await h.type(page.getByPlaceholder("eSewa ID"), "9711111111");
      await h.type(page.getByPlaceholder("Password/MPIN"), "Test@123");
      h.cut.from();
      console.log("   -> tick \"I'm not a robot\" and press LOGIN in the window");
      const pw = page.getByPlaceholder("Password/MPIN");
      for (let i = 0; i < 900 && (await pw.isVisible().catch(() => false)); i++) await page.waitForTimeout(1000);
      const token = page.getByPlaceholder(/verification token/i);
      await token.waitFor({ timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(800);
      await h.cut.to();
      if (await token.count()) {
        h.say("Enter the code");
        await h.type(token, "123456");
        await h.click(page.getByRole("button", { name: /verify/i }), { after: 300 });
        h.cut.from();
        await page.locator("button:visible").filter({ hasText: /continue/i }).first().waitFor({ timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(800);
        await h.cut.to();
      }
      h.say("Confirm the payment");
      for (let k = 0; k < 6 && !/localhost/.test(page.url()); k++) {
        const payBtn = page.locator("button:visible").filter({ hasText: /pay via esewa/i }).first();
        const go = (await payBtn.count()) ? payBtn : page.locator("button:visible").filter({ hasText: /continue|confirm|proceed|submit|ok/i }).first();
        if (!(await go.count())) {
          await page.waitForTimeout(1000);
          continue;
        }
        const last = (await go.innerText()).trim();
        await h.click(go, { after: 400 });
        if (/pay via esewa/i.test(last)) break;
        await page.waitForTimeout(1200);
      }
      h.cut.from();
      await page.waitForURL(/localhost/, { timeout: 90000 }).catch(() => {});
      await page.waitForLoadState("load").catch(() => {});
      await page.getByText(/paid|confirmed|thank|sent|got your/i).first().waitFor({ timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1200);
      await h.cut.to();
      console.log("   back at", page.url().slice(0, 80));
      h.say(done);
      // Hold on the result with a slow look down it.
      await page.waitForTimeout(1200);
      await page.evaluate(() => window.scrollBy({ top: 240, behavior: "smooth" }));
      await page.waitForTimeout(1800);
    },
  };

  // The screencast, restarted on a fresh session whenever the page moves to another site (eSewa and
  // back): a cross-site page runs in a new process and the old session stops sending frames.
  const frames = [];
  let cdp = null;
  const screencast = async () => {
    if (cdp) await cdp.detach().catch(() => {});
    cdp = await ctx.newCDPSession(page);
    cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
      frames.push({ t: now(), buf: Buffer.from(data, "base64") }); // our clock: each renderer keeps its own
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: VW * SCALE, maxHeight: VH * SCALE, everyNthFrame: 1 });
  };
  await screencast();
  let host = new URL(page.url()).host;
  page.on("framenavigated", (f) => {
    if (f !== page.mainFrame()) return;
    const next = (() => { try { return new URL(f.url()).host; } catch { return host; } })();
    if (next !== host) {
      host = next;
      void screencast().catch(() => {});
    }
  });
  await page.waitForTimeout(500);
  try {
    await act(h);
  } catch (e) {
    console.log(name, "ACTION FAILED", String(e).split("\n")[0].slice(0, 240));
  }
  await page.waitForTimeout(600);
  cur.push({ t: now(), x: at.x, y: at.y });
  await cdp?.send("Page.stopScreencast").catch(() => {});
  await browser.close();
  if (frames.length < 5) return console.log(name, "too few frames");

  // ---- The edit ----
  // 1. Cuts: what is taken out (loading, the robot check), everything after moves up.
  const inCut = (t) => cuts.some(([a, b]) => b && t > a && t < b);
  const cutShift = (t) => cuts.reduce((s2, [a, b]) => (b && t >= b ? s2 + (b - a) : s2), 0);
  for (const arr of [frames, cur, events, says]) {
    for (let i = arr.length - 1; i >= 0; i--) if (inCut(arr[i].t)) arr.splice(i, 1);
    for (const x of arr) x.t -= cutShift(x.t);
  }
  // 2. Still moments last at most 0.7 s.
  const shifts = [];
  let shift = 0;
  for (let i = 1; i < frames.length; i++) {
    const gap = frames[i].t - frames[i - 1].t;
    const busy = cur.some((c) => c.t > frames[i - 1].t && c.t < frames[i].t);
    if (gap > 0.7 && !busy) {
      shift += gap - 0.7;
      shifts.push([frames[i].t, shift]);
    }
  }
  const warp = (t) => {
    let s2 = 0;
    for (const [ot, sh] of shifts) if (t >= ot) s2 = sh;
    return t - s2;
  };
  for (const arr of [frames, cur, events, says]) for (const x of arr) x.t = warp(x.t);
  const t0 = frames[0].t;
  const tEnd = frames[frames.length - 1].t;
  // 3. Speed: typing fast, clicks at life speed, a caption held while it is read, the rest a little quick.
  const rate = (s) => {
    for (const e of events) if (e.kind === "type" && s > e.t + 0.15 && s < e.t + (e.long ?? 0)) return 2.5;
    for (const e of events) if ((e.kind === "click" || e.kind === "drag") && s > e.t - 0.6 && s < e.t + 0.5) return 1;
    for (const c of says) if (s > c.t && s < c.t + 0.9 + 0.045 * c.text.length) return 1;
    return 1.45;
  };
  const DS = 1 / 240;
  const S = [t0], O = [0];
  for (let s = t0 + DS; s <= tEnd; s += DS) {
    S.push(s);
    O.push(O[O.length - 1] + DS / rate(s));
  }
  const oOf = (s) => {
    let lo = 0, hi = S.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (S[m] <= s) lo = m;
      else hi = m - 1;
    }
    return O[lo];
  };
  const srcAt = (o) => {
    let lo = 0, hi = O.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (O[m] <= o) lo = m;
      else hi = m - 1;
    }
    return S[lo];
  };
  const oEnd = O[O.length - 1];
  // Captions in film time: from a beat before their action, until the next caption.
  const caps = says.map((c, i) => {
    const o0 = Math.max(0, oOf(c.t) - 0.1);
    const next = says[i + 1] ? oOf(says[i + 1].t) - 0.25 : oEnd;
    return { n: i + 1, text: c.text, o0, o1: Math.max(o0 + 1.6, next) };
  });
  const N = caps.length;

  const cursorAt = (t) => {
    if (t <= cur[0].t) return cur[0];
    for (let i = 1; i < cur.length; i++) {
      if (cur[i].t >= t) {
        const a = cur[i - 1], b = cur[i];
        const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    return cur[cur.length - 1];
  };
  const want = (t) => {
    let z = 1, fx = null, fy = null;
    for (const e of events) {
      const from = e.t - 0.7, to = e.t + 1.1 + (e.long ?? 0);
      if (t >= from && t <= to) {
        const zz = e.kind === "drag" ? 1.25 : 1.55;
        if (zz >= z) {
          z = zz;
          fx = e.x;
          fy = e.y;
        }
      }
    }
    return { z, fx, fy };
  };

  const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "pipe:0", "-c:v", "libvpx", "-b:v", "1100k", "-crf", "12", "-deadline", "good", "-cpu-used", "1", "-auto-alt-ref", "1", "-lag-in-frames", "16", "-g", "150", "-pix_fmt", "yuv420p", "-an", `${OUT}/${name}.webm`], { stdio: ["pipe", "ignore", "pipe"] });
  let err = "";
  ff.stderr.on("data", (d) => (err += d));
  const write = async (buf) => {
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  };
  const sheet = [];
  const INTRO = 33, END = 54;

  // The title card, dissolving into the first frame.
  const firstFrame = await sharp(await sharp(frames[0].buf).resize(VW * SCALE, VH * SCALE, { fit: "cover", position: "top" }).toBuffer()).resize(OW, OH).toBuffer();
  let poster = null;
  for (let k = 0; k < INTRO; k++) {
    const a = easeOut(Math.min(1, k / 8));
    const fade = k < INTRO - 8 ? 1 : 1 - (k - (INTRO - 8)) / 8;
    const frame = await sharp(firstFrame).composite([{ input: introSvg(meta.title, a, 10 * (1 - a), fade) }]).jpeg({ quality: 90 }).toBuffer();
    if (k === 12) {
      poster = frame;
      sheet.push(await sharp(frame).resize(320).toBuffer());
    }
    await write(frame);
  }

  // The film.
  let z = 1, cx = VW / 2, cy = VH / 2, j = 0, last = null;
  const nOut = Math.floor(oEnd * FPS);
  for (let k = 0; k <= nOut; k++) {
    const o = k / FPS;
    const t = srcAt(o);
    while (j + 1 < frames.length && frames[j + 1].t <= t) j++;
    const w = want(t);
    const c = cursorAt(t);
    const tx = w.z > 1 ? w.fx * 0.55 + c.x * 0.45 : VW / 2;
    const ty = w.z > 1 ? w.fy * 0.55 + c.y * 0.45 : VH / 2;
    z += (w.z - z) * 0.075;
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    const cw = VW / z, ch = VH / z;
    const left = Math.min(Math.max(cx - cw / 2, 0), VW - cw);
    const top = Math.min(Math.max(cy - ch / 2, 0), VH - ch);
    const src = await sharp(frames[j].buf).resize(VW * SCALE, VH * SCALE, { fit: "cover", position: "top" }).toBuffer();
    const base = await sharp(src).extract({ left: Math.round(left * SCALE), top: Math.round(top * SCALE), width: Math.round(cw * SCALE), height: Math.round(ch * SCALE) }).resize(OW, OH).toBuffer();
    const layers = [];
    for (const e of events) {
      const age = t - e.t;
      if (e.kind === "click" && age >= 0 && age < 0.5) {
        const r = Math.round(10 + age * 70);
        const ex = ((e.x - left) / cw) * OW, ey = ((e.y - top) / ch) * OH;
        layers.push({ input: ring(r, 1 - age / 0.5), left: Math.round(ex - r - 4), top: Math.round(ey - r - 4) });
      }
    }
    const sx = ((c.x - left) / cw) * OW, sy = ((c.y - top) / ch) * OH;
    if (sx > -40 && sy > -40 && sx < OW && sy < OH) layers.push({ input: cursorSvg, left: Math.round(sx - 3), top: Math.round(sy - 2) });
    // The caption of this moment: in over 10 frames, out over 6; up top when the action is low.
    const cap = caps.find((q) => o >= q.o0 && o <= q.o1);
    if (cap) {
      const inK = Math.min(1, (o - cap.o0) * FPS / 10), outK = Math.min(1, (cap.o1 - o) * FPS / 6);
      const a = Math.min(easeOut(inK), outK);
      const dy = 14 * (1 - easeOut(inK)) - 6 * (1 - outK);
      const low = sy > OH - 190;
      const svg = captionSvg(cap.n, N, cap.text, a, low ? dy - 566 : dy);
      layers.push({ input: svg, left: 0, top: 0 });
    }
    layers.push({ input: barSvg(o / oEnd), left: 0, top: OH - 3 });
    const frame = await sharp(base)
      .composite(layers.filter((l) => l.left > -200 && l.top > -200 && l.left < OW && l.top < OH).map((l) => ({ ...l, left: Math.max(0, l.left), top: Math.max(0, l.top) })))
      .jpeg({ quality: 90 })
      .toBuffer();
    last = base;
    if (k % FPS === 0) sheet.push(await sharp(frame).resize(320).toBuffer());
    await write(frame);
  }

  // The end card: the result, dimmed, with its title and a tick drawn on.
  const dim = await sharp(last).modulate({ brightness: 0.32 }).toBuffer();
  for (let k = 0; k < END; k++) {
    const kk = Math.min(1, k / 30);
    const frame = await sharp(dim).composite([{ input: endSvg(meta.end, meta.sub, kk) }]).jpeg({ quality: 90 }).toBuffer();
    if (k === END - 1) sheet.push(await sharp(frame).resize(320).toBuffer());
    await write(frame);
  }

  ff.stdin.end();
  const code = await new Promise((r) => ff.on("close", r));
  if (code !== 0) console.log(name, "ffmpeg failed", err.slice(-400));
  await sharp(poster).webp({ quality: 80 }).toFile(`${OUT}/${name}.webp`);
  const rows = Math.ceil(sheet.length / 6);
  await sharp({ create: { width: 320 * 6, height: 200 * rows, channels: 3, background: "#888" } })
    .composite(sheet.map((b, i) => ({ input: b, left: (i % 6) * 320, top: Math.floor(i / 6) * 200 })))
    .png()
    .toFile(`${name}-sheet.png`);
  const secs = (INTRO + nOut + END) / FPS;
  console.log(name, "steps", JSON.stringify(caps.map((c) => [c.text, Math.round((INTRO / FPS + c.o0 + 0.15) * 10) / 10])));
  console.log(name, `${secs.toFixed(1)}s`, `${Math.round(fs.statSync(`${OUT}/${name}.webm`).size / 1024)} KB`, `${N} captions`);
}

const phone = () => "98" + String(Math.floor(1e7 + Math.random() * 9e7));

// 1. How shopping works: the rail, a size, Buy now, the number, pay with eSewa, the order confirmed.
await record("shop", "/", { title: "How shopping works", end: "Order confirmed", sub: "Pickup is free, the same day" }, async (h) => {
  const p = h.page;
  h.say("Find the rail");
  await h.scrollTo("#rail-title", 60);
  const flow = p.getByRole("region", { name: "Tops" }).first();
  const b = await flow.boundingBox();
  h.say("Swipe to browse");
  await h.drag(b.x + b.width * 0.7, b.y + b.height * 0.4, b.x + b.width * 0.42);
  await h.pause(500);
  const first = p.getByRole("region", { name: "The rail" }).locator("section").first();
  const size = first.getByRole("radiogroup", { name: /^Size of/ }).locator("button[role=radio]:not([disabled])");
  h.say("Pick your size");
  if (await size.count()) await h.click(size.first());
  h.say("Tap Buy now");
  await h.click(first.getByRole("button", { name: "Buy now" }).first(), { after: 1100 });
  const dlg = p.getByRole("dialog");
  h.say("Enter your number");
  await h.type(dlg.getByLabel("Mobile number"), phone());
  h.say("Pickup is free");
  await h.pause(1400);
  h.say("Tap Pay");
  await h.click(dlg.getByRole("button", { name: /^Pay Rs/ }), { after: 300 });
  await h.esewa();
});

// 2. Designer Fits: a ready-made fit, an occasion, the sizes, Quick buy, pay, confirmed.
await record("outfits", "/fits", { title: "Designer Fits", end: "Order confirmed", sub: "The whole fit, in one go" }, async (h) => {
  const p = h.page;
  const occasions = p.getByRole("navigation", { name: "Occasions" }).locator("a:visible, button:visible");
  h.say("Choose an occasion");
  if ((await occasions.count()) > 1) await h.click(occasions.nth(1), { after: 1200 });
  const nextFit = p.getByRole("button", { name: "Next fit" }).first();
  h.say("Browse the fits");
  if (await nextFit.count()) await h.click(nextFit, { after: 1200 });
  h.say("Pick each size");
  const groups = p.locator("[aria-label^='Size for ']:visible");
  for (let i = 0; i < (await groups.count()); i++) {
    const opt = groups.nth(i).locator("button:not([disabled])").first();
    if (await opt.count()) await h.click(opt, { ms: 500, after: 300 });
  }
  h.say("Tap Quick buy");
  await h.click(p.getByRole("button", { name: /^Quick buy the fit/ }).first(), { after: 1300 });
  const dlg = p.getByRole("dialog");
  h.say("Enter your number");
  await h.type(dlg.getByLabel("Mobile number"), phone());
  h.say("Tap Pay");
  await h.click(dlg.getByRole("button", { name: /^Pay Rs/ }), { after: 300 });
  await h.esewa();
});

// 3. The Gift: a piece, they pick the size, their name and a note, their email, your number, pay, sent.
await record("gift", "/gift", { title: "Send a gift", end: "Sent", sub: "They pick their size · swap within 14 days" }, async (h) => {
  const p = h.page;
  h.say("Send a piece");
  await h.click(p.getByRole("link", { name: /Send a piece/ }).first(), { after: 1200 });
  h.say("Send it as a gift");
  await h.click(p.getByRole("button", { name: /Send it as a gift/ }).first(), { after: 1500 });
  const g = p.getByRole("dialog");
  h.say("Let them pick the size");
  await h.click(g.getByRole("button", { name: "Continue" }), { after: 900 });
  h.say("Write their name");
  await h.type(g.locator("#g-rname"), "Sita");
  await h.type(g.locator("#g-sender"), "Saroj");
  const bday = g.getByRole("button", { name: "Birthday" });
  h.say("Pick the occasion");
  if (await bday.count()) await h.click(bday, { after: 900 });
  await h.click(g.getByRole("button", { name: "Continue" }), { after: 900 });
  h.say("Add their email");
  await h.type(g.locator("#g-remail"), "sita@example.com");
  h.say("Your mobile number");
  await h.type(g.locator("#g-bphone"), phone());
  h.say("Tap Pay");
  await h.click(g.getByRole("button", { name: /^Pay Rs/ }), { after: 300 });
  await h.esewa("Sent. They pick their size");
});

// 4. Gift cards: an amount, their name and email, from, your number, pay, the card sent.
await record("giftcards", "/gift", { title: "Gift cards", end: "Gift card sent", sub: "Valid 12 months · online and in store" }, async (h) => {
  const p = h.page;
  const region = p.getByRole("region", { name: "Gift cards." });
  await region.scrollIntoViewIfNeeded();
  await h.pause(600);
  h.say("Pick an amount");
  await h.click(region.getByRole("button", { name: /^Gift card, Rs/ }).nth(1), { after: 1200 });
  const d = p.getByRole("dialog");
  h.say("Write their name");
  await h.type(d.locator("#gc-rname"), "Aarav");
  h.say("Add their email");
  await h.type(d.locator("#gc-remail"), "aarav@example.com");
  h.say("Add your name");
  await h.type(d.locator("#gc-sender"), "Saroj");
  h.say("Your mobile number");
  await h.type(d.locator("#gc-bphone"), phone());
  h.say("Tap Buy gift card");
  await h.click(d.getByRole("button", { name: /Buy gift card/i }), { after: 300 });
  await h.esewa("Sent, with its code");
});

// 5. Your size: height and weight, build and fit, your size, saved; then a piece opens on your size.
await record("size", "/size-guide", { title: "Find your size", end: "Your size, picked", sub: "Every piece measured in cm" }, async (h) => {
  const p = h.page;
  h.say("Tap Find my size");
  await h.click(p.getByRole("button", { name: /Find my size/ }).first(), { after: 900 });
  const dlg = p.getByRole("dialog");
  h.say("Use height and weight");
  await h.click(dlg.getByRole("button", { name: /Use my height and weight/ }), { after: 600 });
  h.say("Set your height");
  const more = dlg.getByRole("button", { name: "More height" });
  for (let i = 0; i < 3; i++) await h.click(more, { ms: 250, after: 150 });
  h.say("Tap Next");
  await h.click(dlg.getByRole("button", { name: "Next" }), { after: 800 });
  h.say("See your size");
  await h.click(dlg.getByRole("button", { name: "See my size" }), { after: 1600 });
  const save = dlg.getByRole("button", { name: /Save my size|Save changes/ });
  h.say("Save your size");
  if (await save.count()) await h.click(save, { after: 1200 });
  h.say("Your size, already picked");
  await p.goto(p.url().replace(/\/size-guide.*$/, "/product/everyday-hoodie"), { waitUntil: "load" });
  await p.getByText(/Your fit/).first().waitFor({ timeout: 20000 }).catch(() => {});
  await h.pause(2600);
});

// 6. The Vault (live data, so no paying): the brands, every piece, a piece, a size, Buy now.
await record("vault", "/vault", { title: "The Vault", end: "Buy now, no account", sub: "Original pieces, mostly one of each" }, async (h) => {
  const p = h.page;
  h.say("Choose a brand");
  await h.scrollTo("#vault-brands", 60);
  await h.pause(600);
  h.say("See every piece");
  await h.scrollTo("#inventory", 30);
  h.say("Open a piece");
  await h.click(p.locator("#inventory a[href^='/product/']").first(), { after: 2000 });
  await p.getByText("Checking stock…").waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
  const size = p.locator('label:has(input[name="size"]:not([disabled]))').first();
  h.say("Pick your size");
  if (await size.count()) await h.click(size, { after: 600 });
  h.say("Tap Buy now");
  const buy = p.getByRole("button", { name: /^Buy now/ }).first();
  if (await buy.count()) await h.click(buy, { after: 2200 });
});

// 7. The Drop: the countdown, Notify me, you're in, then the drop's pieces.
await record("drops", "/drops", { title: "The Drop", end: "You're in", sub: "One message on drop day" }, async (h) => {
  const p = h.page;
  h.say("Leave your email");
  await h.type(p.getByLabel(/WhatsApp|email|number/i).first(), "you@example.com");
  h.say("Tap Notify me");
  await h.click(p.getByRole("button", { name: /Notify me/ }).first(), { after: 1800 });
  const shop = p.getByRole("link", { name: /^Shop Drop/ }).first();
  h.say("Shop the drop");
  if (await shop.count()) await h.click(shop, { after: 2600 });
});

console.log("done");

// 8. Pick, our AI assistant (on the test copy his answers come from the rules alone, PICK_AI=off): your
// own words, real pieces in your size, one into the bag.
await record("ask-pick", "/shop", { title: "Ask Pick", end: "In your bag", sub: "Your words · real pieces · your size" }, async (h) => {
  const p = h.page;
  await h.scrollTo("#pick", 150);
  h.say("Tap Ask Pick");
  await h.click(p.getByRole("button", { name: /Ask Pick, our AI assistant/ }), { after: 300 });
  // Cut while he arrives.
  h.cut.from();
  const line = p.getByRole("button", { name: /Tap me to chat/ });
  await line.waitFor({ timeout: 60000 });
  await h.pause(500);
  await h.cut.to();
  h.say("Tap Pick to chat");
  await h.click(line, { after: 500 });
  // He walks, so the tap can miss his line: tapped again, off camera.
  const box = p.locator("#pick-say");
  if (!(await box.isVisible().catch(() => false))) {
    h.cut.from();
    await line.click({ force: true }).catch(() => {});
    await box.waitFor({ timeout: 20000 });
    await h.pause(400);
    await h.cut.to();
  }
  h.say("Ask in your own words");
  await h.type(p.locator("#pick-say"), "something oversized in M, under 2500");
  h.say("Tap Send");
  await h.click(p.getByRole("button", { name: "Send", exact: true }), { after: 300 });
  // A moment of him thinking, then a cut to his answer.
  await h.pause(1700);
  h.cut.from();
  await p.getByLabel("Pick's suggestions").waitFor({ timeout: 30000 });
  await h.pause(400);
  await h.cut.to();
  h.say("Real pieces, in your size");
  await h.pause(2400);
  h.say("Add one to your bag");
  await h.click(p.getByRole("button", { name: /^Add .+ in M to bag$/ }).first(), { after: 1800 });
});
