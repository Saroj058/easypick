// The photo helpers behind "Add a piece" (owner, 19 Oct 2026: "it should do everything itself"):
// find the garment on a plain background, crop it to the shop's 4:5 with even space round it, lift
// it off the background for the rack and the fits, and read its colour. All in the browser on a
// canvas, so nothing is sent anywhere and nothing is paid for. The pixel maths is pure (works on
// RGBA arrays), so it is tested without a browser.

export type Box = { x: number; y: number; w: number; h: number };
export type Rgb = [number, number, number];

export interface Reading {
  /** The garment's box in the picture (pixels of the analysed size). */
  box: Box;
  /** The background colour, read from the edges. */
  ground: Rgb;
  /** True when the edges are one even colour: then cut-outs work. */
  plain: boolean;
  /** The garment's main colour. */
  colour: Rgb;
  /** Where the garment sits, 0–1 each way: keeps it in view when a card crops the photo. */
  focus: { x: number; y: number };
}

const dist = (a: Rgb, b: Rgb) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

/** Reads a picture's RGBA pixels: background from the edges, the garment's box, colour and centre. */
export function readPixels(data: Uint8ClampedArray, width: number, height: number): Reading {
  const px = (x: number, y: number): Rgb => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // The edges: a band 2% deep all round.
  const band = Math.max(1, Math.round(Math.min(width, height) * 0.02));
  const edge: Rgb[] = [];
  const step = Math.max(1, Math.round(Math.max(width, height) / 300));
  for (let x = 0; x < width; x += step)
    for (let d = 0; d < band; d += Math.max(1, Math.floor(band / 3))) {
      edge.push(px(x, d), px(x, height - 1 - d));
    }
  for (let y = 0; y < height; y += step)
    for (let d = 0; d < band; d += Math.max(1, Math.floor(band / 3))) {
      edge.push(px(d, y), px(width - 1 - d, y));
    }
  const ground: Rgb = [median(edge.map((c) => c[0])), median(edge.map((c) => c[1])), median(edge.map((c) => c[2]))];
  const spread = median(edge.map((c) => dist(c, ground)));
  const far = edge.filter((c) => dist(c, ground) > 40).length / edge.length;
  const plain = spread < 14 && far < 0.08;

  // The garment: everything clearly unlike the background. Rows and columns need a few such
  // pixels to count, so specks of dust and shadow at the edge don't stretch the box.
  const cut = Math.max(28, spread * 3);
  const rows = new Array<number>(height).fill(0);
  const cols = new Array<number>(width).fill(0);
  let r = 0,
    g = 0,
    b = 0,
    n = 0,
    sx = 0,
    sy = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const c = px(x, y);
      if (dist(c, ground) > cut) {
        rows[y]++;
        cols[x]++;
        r += c[0];
        g += c[1];
        b += c[2];
        n++;
        sx += x;
        sy += y;
      }
    }
  const minRow = Math.max(2, Math.round(width * 0.01));
  const minCol = Math.max(2, Math.round(height * 0.01));
  let top = rows.findIndex((v) => v >= minRow);
  let bottom = height - 1 - [...rows].reverse().findIndex((v) => v >= minRow);
  let left = cols.findIndex((v) => v >= minCol);
  let right = width - 1 - [...cols].reverse().findIndex((v) => v >= minCol);
  if (top < 0 || left < 0 || n < width * height * 0.01) {
    // Nothing stands out (or it fills the frame): treat the whole picture as the garment.
    top = 0;
    left = 0;
    bottom = height - 1;
    right = width - 1;
  }
  const colour: Rgb = n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : ground;
  return {
    box: { x: left, y: top, w: right - left + 1, h: bottom - top + 1 },
    ground,
    plain,
    colour: refineColour(data, width, height, ground, cut) ?? colour,
    focus: n ? { x: Math.round((sx / n / width) * 100) / 100, y: Math.round((sy / n / height) * 100) / 100 } : { x: 0.5, y: 0.5 },
  };
}

/** The garment's most common colour (the average of a striped tee is muddy): a coarse histogram. */
function refineColour(data: Uint8ClampedArray, width: number, height: number, ground: Rgb, cut: number): Rgb | null {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.round(Math.sqrt((width * height) / 40_000)));
  for (let y = 0; y < height; y += step)
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const c: Rgb = [data[i], data[i + 1], data[i + 2]];
      if (dist(c, ground) <= cut) continue;
      const k = ((c[0] >> 5) << 6) | ((c[1] >> 5) << 3) | (c[2] >> 5);
      const bin = bins.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
      bin.n++;
      bin.r += c[0];
      bin.g += c[1];
      bin.b += c[2];
      bins.set(k, bin);
    }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const v of bins.values()) if (!best || v.n > best.n) best = v;
  return best ? [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)] : null;
}

/** The 4:5 frame round the garment with even space (12% by default), kept inside the picture where it can be. */
export function frameFor(box: Box, width: number, height: number, room = 0.12): Box {
  const ratio = 4 / 5;
  let h = box.h * (1 + room * 2);
  let w = box.w * (1 + room * 2);
  if (w / h > ratio) h = w / ratio;
  else w = h * ratio;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  let x = cx - w / 2;
  let y = cy - h / 2;
  // Slide the frame back inside the picture when there's room; otherwise the edges are filled.
  if (w <= width) x = Math.min(Math.max(0, x), width - w);
  if (h <= height) y = Math.min(Math.max(0, y), height - h);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/**
 * Lifts the garment off a plain background: every pixel joined to the edge and near the background
 * colour turns clear (a flood from the edges, so a white print on a white tee stays). Soft edge.
 * Changes `data` in place.
 */
export function clearGround(data: Uint8ClampedArray, width: number, height: number, ground: Rgb, tolerance = 34) {
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const near = (i: number) => dist([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]], ground) <= tolerance;
  const push = (i: number) => {
    if (!seen[i] && near(i)) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (y > 0) push(i - width);
    if (y < height - 1) push(i + width);
  }
  for (let i = 0; i < width * height; i++) if (seen[i]) data[i * 4 + 3] = 0;
  // A soft edge: a garment pixel next to the cleared ground goes half clear.
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (seen[i]) continue;
      if (seen[i - 1] || seen[i + 1] || seen[i - width] || seen[i + width]) data[i * 4 + 3] = 140;
    }
}

// ---------- Colour names ----------

const NAMED: [string, string][] = [
  ["Black", "#111111"],
  ["Charcoal", "#36383c"],
  ["Grey", "#8a8c91"],
  ["Light grey", "#c4c6c9"],
  ["White", "#f5f5f2"],
  ["Cream", "#ece4d2"],
  ["Beige", "#d6c3a3"],
  ["Sand", "#c2a878"],
  ["Khaki", "#9c8f63"],
  ["Brown", "#5a3d2b"],
  ["Tan", "#a87a51"],
  ["Olive", "#5b5f3a"],
  ["Sage", "#9aa98a"],
  ["Forest", "#2f4a34"],
  ["Green", "#3f8f4f"],
  ["Navy", "#1d2a44"],
  ["Blue", "#2f5fa8"],
  ["Sky blue", "#8fb8e0"],
  ["Washed blue", "#6c86a3"],
  ["Indigo", "#2d3561"],
  ["Teal", "#2a7277"],
  ["Maroon", "#5e1f26"],
  ["Red", "#b3262e"],
  ["Rust", "#a4502c"],
  ["Orange", "#e0782f"],
  ["Mustard", "#c99a2e"],
  ["Yellow", "#e9cf45"],
  ["Pink", "#e5a5b4"],
  ["Lilac", "#b7a6cc"],
  ["Purple", "#5d3f78"],
];

export const toHex = (c: Rgb) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const fromHex = (h: string): Rgb => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** The nearest everyday colour name ("Olive", "Washed blue") for a colour. */
export function colourName(c: Rgb): string {
  let best = NAMED[0];
  let d = Infinity;
  for (const n of NAMED) {
    const x = dist(c, fromHex(n[1]));
    if (x < d) {
      d = x;
      best = n;
    }
  }
  return best[0];
}

// ---------- In the browser ----------

const ANALYSE = 360;

async function bitmapOf(file: Blob) {
  return createImageBitmap(file);
}

/** Reads a photo (scaled down to look at it quickly); the box is in the photo's own pixels. */
export async function readPhoto(file: Blob): Promise<(Reading & { width: number; height: number }) | null> {
  const bm = await bitmapOf(file).catch(() => null);
  if (!bm) return null;
  const s = Math.min(1, ANALYSE / Math.max(bm.width, bm.height));
  const w = Math.max(1, Math.round(bm.width * s));
  const h = Math.max(1, Math.round(bm.height * s));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bm, 0, 0, w, h);
  const r = readPixels(ctx.getImageData(0, 0, w, h).data, w, h);
  const up = 1 / s;
  return { ...r, box: { x: r.box.x * up, y: r.box.y * up, w: r.box.w * up, h: r.box.h * up }, width: bm.width, height: bm.height };
}

/** The photo cropped to 4:5 round the garment, filled with its background where the frame runs off, as a JPEG at most 1600×2000. */
export async function cropPhoto(file: Blob, reading: Reading & { width: number; height: number }, name = "photo"): Promise<File | null> {
  const bm = await bitmapOf(file).catch(() => null);
  if (!bm) return null;
  const f = frameFor(reading.box, reading.width, reading.height);
  const scale = Math.min(1, 1600 / f.w);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(f.w * scale);
  canvas.height = Math.round(f.h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = toHex(reading.ground);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bm, -f.x * scale, -f.y * scale, bm.width * scale, bm.height * scale);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
  return blob ? new File([blob], `${name}.jpg`, { type: "image/jpeg" }) : null;
}

/** The garment lifted off its background, trimmed to it, as a WebP with a clear background (at most 1200 px). */
export async function cutOutPhoto(file: Blob, reading: Reading & { width: number; height: number }, name = "cutout"): Promise<File | null> {
  if (!reading.plain) return null;
  const bm = await bitmapOf(file).catch(() => null);
  if (!bm) return null;
  const pad = Math.round(Math.max(reading.box.w, reading.box.h) * 0.03);
  const bx = Math.max(0, Math.round(reading.box.x - pad));
  const by = Math.max(0, Math.round(reading.box.y - pad));
  const bw = Math.min(bm.width - bx, Math.round(reading.box.w + pad * 2));
  const bh = Math.min(bm.height - by, Math.round(reading.box.h + pad * 2));
  const scale = Math.min(1, 1200 / Math.max(bw, bh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bw * scale));
  canvas.height = Math.max(1, Math.round(bh * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bm, bx, by, bw, bh, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  clearGround(img.data, canvas.width, canvas.height, reading.ground);
  ctx.putImageData(img, 0, 0);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
  // Browsers without WebP encoding hand back PNG; both are fine.
  return blob ? new File([blob], `${name}.${blob.type === "image/webp" ? "webp" : "png"}`, { type: blob.type }) : null;
}
