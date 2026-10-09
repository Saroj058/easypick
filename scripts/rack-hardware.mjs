// Turns the three generated photographs (a hanger, a clip hanger for trousers, a steel rail) into
// cut-out pictures for the home page's wardrobe. They were photographed on white; the white is
// flooded away from the picture's edges and from any seed points given (the hole inside a hanger).
// Run: node scripts/rack-hardware.mjs <folder with hanger.png, clip.png, rail.png>
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const dir = process.argv[2];
const OUT = "public/rack";
mkdirSync(OUT, { recursive: true });

async function cut(file, out, { crop, light, seeds = [], width }) {
  let img = sharp(file);
  const meta = await img.metadata();
  if (crop) img = img.extract({ left: 0, top: Math.round(meta.height * crop[0]), width: meta.width, height: Math.round(meta.height * (crop[1] - crop[0])) });
  const { data, info } = await img.resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // Background: bright and colourless.
  const isBg = (i) => Math.min(data[i], data[i + 1], data[i + 2]) > light && Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) < 22;
  const seen = new Uint8Array(w * h);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = y * w + x;
    if (seen[k] || !isBg(k * 4)) return;
    seen[k] = 1;
    queue.push(k);
  };
  for (let x = 0; x < w; x++) (push(x, 0), push(x, h - 1));
  for (let y = 0; y < h; y++) (push(0, y), push(w - 1, y));
  for (const [sx, sy] of seeds) push(Math.round(sx * w), Math.round(sy * h));
  while (queue.length) {
    const k = queue.pop();
    const x = k % w;
    const y = (k - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  const alpha = Buffer.alloc(w * h);
  for (let k = 0; k < w * h; k++) alpha[k] = seen[k] ? 0 : 255;
  const soft = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(1.2).raw().toBuffer({ resolveWithObject: true });
  const step = soft.info.channels;
  for (let k = 0; k < w * h; k++) data[k * 4 + 3] = seen[k] ? 0 : Math.max(0, Math.min(255, (soft.data[k * step] - 100) * 1.8));
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const done = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .webp({ quality: 90, alphaQuality: 92 })
    .toFile(`${OUT}/${out}`);
  console.log(out, `${done.width}x${done.height}`);
}

// The hole inside each hanger is seeded so it empties too.
await cut(`${dir}/hanger.png`, "hanger.webp", { light: 178, seeds: [[0.5, 0.6]], width: 700 });
// The clip hanger was photographed hanging from a rail: the rail at the top is cropped away.
await cut(`${dir}/clip.png`, "hanger-clip.webp", { crop: [0.19, 1], light: 178, seeds: [[0.5, 0.56]], width: 700 });
// The rail: only the rod itself, edge to edge.
await cut(`${dir}/rail.png`, "rail.webp", { crop: [0.44, 0.56], light: 205, width: 1600 });
