// Cuts each hanging garment out of the owner's wardrobe photograph (9 Oct 2026), for the home
// page's wardrobe: the pieces there are real clothes on real hangers, hung on the rail drawn in code.
// Run: node scripts/rack-hung.mjs <path to the photograph, 1408x1136>
//
// Each piece is cropped from just under its rail (so its hanger's neck comes out from behind the
// rail) to above the shelf below. The wall is pale and nearly grey, the clothes are dark or
// coloured, so the wall (and the shadow on it) is found by flooding in from the crop's edges over
// pale, colourless pixels. Only the largest piece left is kept.
import sharp from "sharp";

const src = process.argv[2];
if (!src) throw new Error("Give the photograph's path");
const OUT = "public/rack/hung";
const SCALE = 2; // enlarged first, so the cut edge is smooth on sharp screens

// left, top, right, bottom in the photograph's pixels
const PIECES = {
  "oversized-heavy-tee": [124, 225, 356, 468],
  "everyday-hoodie": [356, 225, 602, 488],
  "boxy-pocket-tee": [602, 225, 796, 474],
  "brushed-crewneck": [796, 225, 1075, 482],
  "washed-co-ord-set": [1075, 225, 1292, 504],
  "tapered-jogger": [166, 583, 332, 884],
  "coach-jacket": [332, 583, 616, 832],
  "relaxed-straight-jean": [616, 583, 804, 886],
  "fleece-quarter-zip": [804, 583, 1080, 846],
  "wide-cargo-pant": [1080, 583, 1256, 870],
};

for (const [slug, [l, t, r, b]] of Object.entries(PIECES)) {
  const { data, info } = await sharp(src)
    .extract({ left: l, top: t, width: r - l, height: b - t })
    .resize({ width: (r - l) * SCALE, kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const wall = (i) => {
    const R = data[i], G = data[i + 1], B = data[i + 2];
    const lo = Math.min(R, G, B), spread = Math.max(R, G, B) - lo;
    return (lo > 118 && spread < 60) || (lo > 72 && spread < 27); // the lit wall, and the soft shadow each piece throws on it
  };

  const seen = new Uint8Array(w * h);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = y * w + x;
    if (seen[k] || !wall(k * 4)) return;
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

  // Keep only the largest thing left: a sliver of the next piece along the rail is not this piece.
  const part = new Int32Array(w * h);
  let best = 0, bestSize = 0;
  for (let k0 = 0, id = 0; k0 < w * h; k0++) {
    if (seen[k0] || part[k0]) continue;
    id++;
    let size = 0;
    const stack = [k0];
    part[k0] = id;
    while (stack.length) {
      const k = stack.pop();
      size++;
      const x = k % w;
      for (const n of [x + 1 < w ? k + 1 : -1, x > 0 ? k - 1 : -1, k + w < w * h ? k + w : -1, k - w])
        if (n >= 0 && !seen[n] && !part[n]) {
          part[n] = id;
          stack.push(n);
        }
    }
    if (size > bestSize) (bestSize = size), (best = id);
  }
  for (let k = 0; k < w * h; k++) if (part[k] !== best) seen[k] = 1;

  const alpha = Buffer.alloc(w * h);
  for (let k = 0; k < w * h; k++) alpha[k] = seen[k] ? 0 : 255;
  const soft = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(1.6).raw().toBuffer({ resolveWithObject: true });
  const step = soft.info.channels;
  for (let k = 0; k < w * h; k++) data[k * 4 + 3] = seen[k] ? 0 : Math.max(0, Math.min(255, (soft.data[k * step] - 150) * 2.6));

  // Crop to the piece, but keep the top edge: that is where it meets the rail.
  let x0 = w, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
  const out = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: 0, width: x1 - x0 + 1, height: y1 + 1 })
    .webp({ quality: 90, alphaQuality: 92 })
    .toFile(`${OUT}/${slug}.webp`);
  console.log(slug.padEnd(24), `${out.width}x${out.height}`);
}
