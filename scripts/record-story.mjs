// The home hero's how-to films (public/story/video). Run the test copy first (the e2e server on :3100,
// payments in test mode, never the live site for anything that orders), then:
//   node scripts/record-story.mjs [name]        (the Vault needs pieces: BASE=http://localhost:3301 for a
//                                                 read-only preview of the live data)
// Contact sheets (<name>-web-sheet.png) land in the current folder, to check each film by eye.
//
// Desktop recordings of the site in use, edited like a screen-film: the camera glides and zooms in
// on each click and typing, eases out between them; a clean cursor and a ring on every click are
// drawn in afterwards. CDP screencast → edited frames → VP8 WebM (Playwright's ffmpeg).
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

async function record(name, url, act) {
  if (only && only !== name) return;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: SCALE });
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem("ep-intro-seen", "1"); } catch {}
    const st = document.createElement("style");
    st.textContent = "nextjs-portal{display:none!important} *{cursor:none!important}";
    const add = () => document.documentElement.appendChild(st);
    if (document.readyState === "loading") addEventListener("DOMContentLoaded", add); else add();
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(BASE + url, { waitUntil: "load", timeout: 240000 });
  await page.waitForTimeout(2500);

  // What the editor needs: where the cursor was, and when something happened.
  const cur = [{ t: now(), x: VW * 0.62, y: VH * 0.7 }];
  const events = []; // { t, x, y, kind: "click" | "type" | "drag" }
  let at = { x: VW * 0.62, y: VH * 0.7 };
  const glide = async (x, y, ms = 650) => {
    const n = Math.max(8, Math.round(ms / 16));
    const a = { ...at };
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // ease in-out
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
      const n = 24;
      for (let i = 1; i <= n; i++) {
        const px = x0 + ((x1 - x0) * i) / n;
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
  };

  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, buf: Buffer.from(data, "base64") });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: VW * SCALE, maxHeight: VH * SCALE, everyNthFrame: 1 });
  await page.waitForTimeout(500);
  try {
    await act(h);
  } catch (e) {
    console.log(name, "ACTION FAILED", String(e).split("\n")[0].slice(0, 240));
  }
  await page.waitForTimeout(900);
  cur.push({ t: now(), x: at.x, y: at.y });
  await cdp.send("Page.stopScreencast");
  await browser.close();
  if (frames.length < 5) return console.log(name, "too few frames");

  // Cut the dead time: a still moment never lasts more than 0.7 s; cursor and events move with it.
  const shifts = []; // [origT, shiftSoFar]
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
    let s = 0;
    for (const [ot, sh] of shifts) if (t >= ot) s = sh;
    return t - s;
  };
  const F = frames.map((f) => ({ t: warp(f.t), buf: f.buf }));
  const C = cur.map((c) => ({ ...c, t: warp(c.t) }));
  const E = events.map((e) => ({ ...e, t: warp(e.t) }));
  const t0 = F[0].t;
  const end = F[F.length - 1].t;
  const n = Math.floor((end - t0) * FPS);

  const cursorAt = (t) => {
    if (t <= C[0].t) return C[0];
    for (let i = 1; i < C.length; i++) {
      if (C[i].t >= t) {
        const a = C[i - 1], b = C[i];
        const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    return C[C.length - 1];
  };
  // How close the camera wants to be: in on each action (a little before it, until a beat after).
  const want = (t) => {
    let z = 1, fx = null, fy = null;
    for (const e of E) {
      const from = e.t - 0.7, to = e.t + 1.1 + (e.long ?? 0);
      if (t >= from && t <= to) {
        const zz = e.kind === "drag" ? 1.25 : 1.6;
        if (zz >= z) { z = zz; fx = e.x; fy = e.y; }
      }
    }
    return { z, fx, fy };
  };

  const cursorSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42"><path d="M3 2 L3 32 L11 25 L17 39 L23 36 L17 23 L28 23 Z" fill="#111" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>`);
  const ring = (r, a) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${2 * r + 8}" height="${2 * r + 8}"><circle cx="${r + 4}" cy="${r + 4}" r="${r}" fill="rgba(17,17,17,${(0.12 * a).toFixed(3)})" stroke="rgba(17,17,17,${(0.7 * a).toFixed(3)})" stroke-width="2.5"/></svg>`);

  const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "pipe:0", "-c:v", "libvpx", "-b:v", "1400k", "-crf", "10", "-deadline", "good", "-cpu-used", "1", "-auto-alt-ref", "0", "-pix_fmt", "yuv420p", "-an", `${OUT}/${name}.webm`], { stdio: ["pipe", "ignore", "pipe"] });
  let err = "";
  ff.stderr.on("data", (d) => (err += d));

  // The camera: smoothed zoom and centre, so it glides and never jumps.
  let z = 1, cx = VW / 2, cy = VH / 2;
  let j = 0;
  const sheet = [];
  let poster = null;
  for (let k = 0; k <= n; k++) {
    const t = t0 + k / FPS;
    while (j + 1 < F.length && F[j + 1].t <= t) j++;
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
    const src = await sharp(F[j].buf).resize(VW * SCALE, VH * SCALE, { fit: "cover", position: "top" }).toBuffer();
    const base = sharp(src)
      .extract({ left: Math.round(left * SCALE), top: Math.round(top * SCALE), width: Math.round(cw * SCALE), height: Math.round(ch * SCALE) })
      .resize(OW, OH);
    // Where the cursor lands in the film, and the ring of a click just made.
    const sx = ((c.x - left) / cw) * OW, sy = ((c.y - top) / ch) * OH;
    const layers = [];
    for (const e of E) {
      const age = t - e.t;
      if (e.kind === "click" && age >= 0 && age < 0.5) {
        const r = Math.round(10 + age * 70);
        const ex = ((e.x - left) / cw) * OW, ey = ((e.y - top) / ch) * OH;
        layers.push({ input: ring(r, 1 - age / 0.5), left: Math.round(ex - r - 4), top: Math.round(ey - r - 4) });
      }
    }
    if (sx > -40 && sy > -40 && sx < OW && sy < OH) layers.push({ input: cursorSvg, left: Math.round(sx - 3), top: Math.round(sy - 2) });
    const frame = await sharp(await base.toBuffer())
      .composite(layers.filter((l) => l.left > -200 && l.top > -200 && l.left < OW && l.top < OH).map((l) => ({ ...l, left: Math.max(0, l.left), top: Math.max(0, l.top) })))
      .jpeg({ quality: 90 })
      .toBuffer();
    if (k === 0) poster = frame;
    if (k % FPS === 0) sheet.push(await sharp(frame).resize(320).toBuffer());
    if (!ff.stdin.write(frame)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  const code = await new Promise((r) => ff.on("close", r));
  if (code !== 0) console.log(name, "ffmpeg failed", err.slice(-400));
  await sharp(poster).webp({ quality: 80 }).toFile(`${OUT}/${name}.webp`);
  await sharp({ create: { width: 320 * 6, height: 200 * Math.ceil(sheet.length / 6), channels: 3, background: "#888" } })
    .composite(sheet.map((b, i) => ({ input: b, left: (i % 6) * 320, top: Math.floor(i / 6) * 200 })))
    .png()
    .toFile(`${name}-web-sheet.png`);
  console.log(name, `${(n / FPS).toFixed(1)}s`, `${Math.round(fs.statSync(`${OUT}/${name}.webm`).size / 1024)} KB`);
}

const phone = () => "98" + String(Math.floor(1e7 + Math.random() * 9e7));

// Shopping: the rail, swipe, a size, Buy now, the number, pay with eSewa.
await record("shop", "/", async (h) => {
  const p = h.page;
  await h.scrollTo("#rail-title", 60);
  const flow = p.getByRole("region", { name: "Tops" }).first();
  const b = await flow.boundingBox();
  await h.drag(b.x + b.width * 0.7, b.y + b.height * 0.4, b.x + b.width * 0.42);
  await h.pause(700);
  const first = p.getByRole("region", { name: "The rail" }).locator("section").first();
  const size = first.getByRole("radiogroup", { name: /^Size of/ }).locator("button[role=radio]:not([disabled])");
  if (await size.count()) await h.click(size.first());
  await h.click(first.getByRole("button", { name: "Buy now" }).first(), { after: 1100 });
  const dlg = p.getByRole("dialog");
  await h.type(dlg.getByLabel("Mobile number"), phone());
  await h.click(dlg.getByRole("button", { name: /^Pay Rs/ }), { after: 300 });
  await p.waitForURL(/esewa|\/order\//, { timeout: 12000, waitUntil: "commit" }).catch(() => {});
  await h.pause(2800);
});

// The Pick: build a fit, the total adds up.
await record("pick", "/fit", async (h) => {
  const groups = h.page.getByRole("radiogroup", { name: / piece$/ });
  const g = await groups.count();
  for (let i = 0; i < Math.min(g, 3); i++) {
    const opts = groups.nth(i).getByRole("radio", { name: /Rs/ });
    const k = await opts.count();
    if (k) await h.click(opts.nth(Math.min(1, k - 1)), { after: 600 });
  }
  await h.page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await h.pause(1800);
});

// The Gift: send a piece, the pieces to choose from.
await record("gift", "/gift", async (h) => {
  const send = h.page.getByRole("link", { name: /Send a piece/ }).first();
  if (await send.count()) await h.click(send, { after: 1600 });
  const card = h.page.getByRole("button", { name: /Send it as a gift/ }).first();
  if (await card.count()) await h.click(card, { after: 1800 });
});

// Gift cards: an amount, their name, pay.
await record("giftcards", "/gift", async (h) => {
  const region = h.page.getByRole("region", { name: "Gift cards." });
  await region.scrollIntoViewIfNeeded();
  await h.pause(800);
  const card = region.getByRole("button", { name: /^Gift card, Rs/ });
  await h.click(card.nth(1), { after: 1300 });
  const dlg = h.page.getByRole("dialog");
  await h.type(dlg.getByLabel(/name/i).first(), "Aarav");
  const mail = dlg.getByLabel(/email/i).first();
  if (await mail.count()) await h.type(mail, "aarav@example.com");
  await h.pause(1200);
});

// The Fits: height and weight, build, your size.
await record("fits", "/size-guide", async (h) => {
  const p = h.page;
  await h.click(p.getByRole("button", { name: /Find my size/ }).first(), { after: 900 });
  const dlg = p.getByRole("dialog");
  await h.click(dlg.getByRole("button", { name: /Use my height and weight/ }), { after: 600 });
  const more = dlg.getByRole("button", { name: "More height" });
  for (let i = 0; i < 3; i++) await h.click(more, { ms: 250, after: 150 });
  await h.click(dlg.getByRole("button", { name: "Next" }), { after: 800 });
  await h.click(dlg.getByRole("button", { name: "See my size" }), { after: 2400 });
});

// The Vault: brands, every piece, one up close.
await record("vault", "/vault", async (h) => {
  await h.scrollTo("#vault-brands", 60);
  await h.pause(700);
  await h.scrollTo("#inventory", 30);
  const card = h.page.locator("#inventory a[href^='/product/']").first();
  if (await card.count()) await h.click(card, { after: 2600 });
});

// The Drop: the drop, Notify me.
await record("drops", "/drops", async (h) => {
  const field = h.page.getByLabel(/WhatsApp|email|number/i).first();
  if (await field.count()) await h.type(field, "you@example.com");
  const btn = h.page.getByRole("button", { name: /Notify me/ }).first();
  if (await btn.count()) await h.click(btn, { after: 1500 });
});

console.log("done");
