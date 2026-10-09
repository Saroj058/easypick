// Makes the neutral "stand-in" garment pictures (public/stand-ins/<kind>.webp) that a product
// without a photo shows, tinted to its own colour by components/product-image.tsx.
// Run: node scripts/stand-ins.mjs
//
// They are the shop's own cut-out product photos (public/rack/<slug>.webp) with the colour taken
// out and the tones lifted to a light grey that keeps the folds and seams, so one picture can be
// dyed any colour.
import sharp from "sharp";

const OWN = {
  tee: "oversized-heavy-tee",
  "pocket-tee": "boxy-pocket-tee",
  hoodie: "everyday-hoodie",
  crewneck: "brushed-crewneck",
  "quarter-zip": "fleece-quarter-zip",
  jacket: "coach-jacket",
  jeans: "relaxed-straight-jean",
  jogger: "tapered-jogger",
  cargo: "wide-cargo-pant",
  cap: "six-panel-cap",
  set: "washed-co-ord-set",
};

/** Light grey with the detail kept: tones stretched over the garment's own range, then set between LOW and HIGH. */
export async function neutral(input, out, LOW = 182, HIGH = 250) {
  const { data, info } = await sharp(input).resize({ width: 640, withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const lum = new Float32Array(n);
  const seen = [];
  for (let k = 0; k < n; k++) {
    lum[k] = 0.299 * data[k * 4] + 0.587 * data[k * 4 + 1] + 0.114 * data[k * 4 + 2];
    if (data[k * 4 + 3] > 200) seen.push(lum[k]);
  }
  seen.sort((a, b) => a - b);
  // The cut-outs keep a rim of the studio shadow along one side, paler than a dark garment. Dyed, it
  // would show as a ghost edge, so pale pixels in the band just inside the outline are cut away.
  const alpha = Buffer.alloc(n);
  for (let k = 0; k < n; k++) alpha[k] = data[k * 4 + 3];
  const inner = await sharp(alpha, { raw: { width: info.width, height: info.height, channels: 1 } }).blur(7).raw().toBuffer({ resolveWithObject: true });
  const step = inner.info.channels;
  const mid = seen[Math.floor(seen.length * 0.5)];
  for (let k = 0; k < n; k++) if (data[k * 4 + 3] > 0 && inner.data[k * step] < 250 && lum[k] > mid + 26) data[k * 4 + 3] = 0;
  const lo = seen[Math.floor(seen.length * 0.02)], hi = seen[Math.floor(seen.length * 0.98)];
  for (let k = 0; k < n; k++) {
    const t = Math.min(1, Math.max(0, (lum[k] - lo) / Math.max(1, hi - lo)));
    const v = Math.round(LOW + (HIGH - LOW) * Math.pow(t, 0.8));
    data[k * 4] = data[k * 4 + 1] = data[k * 4 + 2] = v;
  }
  const o = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 86, alphaQuality: 90 }).toFile(out);
  return `${o.width}x${o.height} ${Math.round(o.size / 1024)} KB`;
}

if (process.argv[1].endsWith("stand-ins.mjs")) for (const [kind, slug] of Object.entries(OWN)) console.log(kind.padEnd(12), await neutral(`public/rack/${slug}.webp`, `public/stand-ins/${kind}.webp`));
