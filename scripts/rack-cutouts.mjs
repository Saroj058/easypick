// Cuts each product's front photo out of its plain studio background, for the home page's
// wardrobe (the pieces hang on a real rail there). Run: node scripts/rack-cutouts.mjs
//
// The photos are flat lays on an even light grey. The background is found by flooding in from
// the picture's edges over pixels close to the edge colour, so a pale area inside a garment
// (a label, a drawstring tip) is never eaten. The edge is then softened by a pixel.
import { mkdirSync, readdirSync, existsSync } from "node:fs";
import sharp from "sharp";

const SRC = "public/products";
const OUT = "public/rack";
const TOLERANCE = Number(process.argv[2] ?? 30); // how far from the background colour still counts as background
mkdirSync(OUT, { recursive: true });

for (const slug of readdirSync(SRC)) {
  const file = `${SRC}/${slug}/front.jpg`;
  if (!existsSync(file)) continue;
  const { data, info } = await sharp(file).resize({ width: 900 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (x, y) => (y * w + x) * 4;

  // The background colour: the average of the four corners.
  const corners = [at(4, 4), at(w - 5, 4), at(4, h - 5), at(w - 5, h - 5)];
  const bg = [0, 1, 2].map((c) => corners.reduce((n, i) => n + data[i + c], 0) / corners.length);
  const far = (i) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);

  // Flood from every edge pixel.
  const seen = new Uint8Array(w * h);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = y * w + x;
    if (seen[k]) return;
    if (far(k * 4) > TOLERANCE) return;
    seen[k] = 1;
    queue.push(k);
  };
  for (let x = 0; x < w; x++) (push(x, 0), push(x, h - 1));
  for (let y = 0; y < h; y++) (push(0, y), push(w - 1, y));
  while (queue.length) {
    const k = queue.pop();
    const x = k % w;
    const y = (k - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  // Alpha: 0 on the background, then a one-pixel blur so the edge isn't jagged.
  const alpha = Buffer.alloc(w * h);
  for (let k = 0; k < w * h; k++) alpha[k] = seen[k] ? 0 : 255;
  const softened = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(1.6).raw().toBuffer({ resolveWithObject: true });
  const step = softened.info.channels; // sharp may hand a grey image back with more than one channel
  for (let k = 0; k < w * h; k++) data[k * 4 + 3] = seen[k] ? 0 : Math.max(0, Math.min(255, (softened.data[k * step] - 110) * 1.9)); // pulled in a touch, so no pale rim of studio grey is left

  // Crop to the garment itself.
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[at(x, y) + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const out = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(`${OUT}/${slug}.webp`);
  console.log(slug.padEnd(24), `${out.width}x${out.height}`, `bg rgb(${bg.map(Math.round).join(",")})`);
}
