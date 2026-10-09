// Prepares the garments' 3D models for the home page's wardrobe.
// Run: node scripts/rack-3d.mjs <folder of <slug>.glb files as generated>
//
// Each generated .glb carries its texture inside the file, which the site's content security
// policy won't let three.js read (it fetches a blob). So the texture is taken out and saved beside
// the model as a small .webp, and the model is rewritten without it (and with 16-bit texture
// coordinates), which also makes it much lighter.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const src = process.argv[2];
if (!src) throw new Error("Give the folder of generated .glb files");
const OUT = "public/rack/3d";
const pad4 = (n) => (n + 3) & ~3;

for (const file of readdirSync(src).filter((f) => f.endsWith(".glb"))) {
  const slug = file.replace(/\.glb$/, "");
  const glb = readFileSync(`${src}/${file}`);
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString());
  const bin = glb.subarray(20 + jsonLen + 8);
  const view = (i) => {
    const v = json.bufferViews[i];
    return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  };

  // The texture, shrunk: the wardrobe shows each piece at a couple of hundred pixels.
  const tex = await sharp(view(json.images[0].bufferView)).resize(512, 512).webp({ quality: 82 }).toFile(`${OUT}/${slug}.webp`);

  // One mesh, one primitive: position, texture coordinates, indices.
  const prim = json.meshes[0].primitives[0];
  const acc = (i) => json.accessors[i];
  const raw = (i) => {
    const a = acc(i);
    const v = json.bufferViews[a.bufferView];
    const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return { a, data: bin.subarray(start, start + v.byteLength - (a.byteOffset ?? 0)) };
  };
  const pos = raw(prim.attributes.POSITION);
  const uv = raw(prim.attributes.TEXCOORD_0);
  const idx = raw(prim.indices);
  const n = pos.a.count;
  if (pos.a.componentType !== 5126 || uv.a.componentType !== 5126) throw new Error(`${slug}: unexpected attribute types`);

  const posOut = Buffer.from(pos.data.subarray(0, n * 12));
  const uvOut = Buffer.alloc(pad4(n * 4));
  for (let i = 0; i < n; i++) {
    const u = uv.data.readFloatLE(i * 8), v = uv.data.readFloatLE(i * 8 + 4);
    uvOut.writeUInt16LE(Math.round(Math.min(1, Math.max(0, u)) * 65535), i * 4);
    uvOut.writeUInt16LE(Math.round(Math.min(1, Math.max(0, v)) * 65535), i * 4 + 2);
  }
  const read = idx.a.componentType === 5125 ? (i) => idx.data.readUInt32LE(i * 4) : (i) => idx.data.readUInt16LE(i * 2);
  const small = n <= 65535;
  const idxOut = Buffer.alloc(pad4(idx.a.count * (small ? 2 : 4)));
  for (let i = 0; i < idx.a.count; i++) small ? idxOut.writeUInt16LE(read(i), i * 2) : idxOut.writeUInt32LE(read(i), i * 4);

  const body = Buffer.concat([posOut, uvOut, idxOut]);
  const out = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2 }] }],
    buffers: [{ byteLength: body.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posOut.length, target: 34962 },
      { buffer: 0, byteOffset: posOut.length, byteLength: n * 4, target: 34962 },
      { buffer: 0, byteOffset: posOut.length + uvOut.length, byteLength: idx.a.count * (small ? 2 : 4), target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: n, type: "VEC3", min: pos.a.min, max: pos.a.max },
      { bufferView: 1, componentType: 5123, normalized: true, count: n, type: "VEC2" },
      { bufferView: 2, componentType: small ? 5123 : 5125, count: idx.a.count, type: "SCALAR" },
    ],
  };
  let j = Buffer.from(JSON.stringify(out));
  j = Buffer.concat([j, Buffer.alloc(pad4(j.length) - j.length, 0x20)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + j.length + 8 + body.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(j.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(body.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  writeFileSync(`${OUT}/${slug}.glb`, Buffer.concat([head, jh, j, bh, body]));
  console.log(slug.padEnd(24), `${n} points, ${idx.a.count / 3} faces`, `model ${Math.round((28 + j.length + body.length) / 1024)} KB`, `texture ${Math.round(tex.size / 1024)} KB`, `size ${pos.a.max.map((m, i) => (m - pos.a.min[i]).toFixed(2)).join(" x ")}`);
}
