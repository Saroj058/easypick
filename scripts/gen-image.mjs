// Generate an image with Google's Gemini API and save it into the site.
//
//   node scripts/gen-image.mjs --list                       list models that can make images
//   node scripts/gen-image.mjs "<prompt>" public/products/x.png [--model <id>] [--ref path.png] [--aspect 4:5]
//
// Reads GEMINI_API_KEY (and optional GEMINI_IMAGE_MODEL) from .env.local.
// --ref sends an existing image with the prompt, to keep a product consistent across shots.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname } from "node:path";

function env(name) {
  if (process.env[name]) return process.env[name];
  if (!existsSync(".env.local")) return undefined;
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() || undefined;
}

const KEY = env("GEMINI_API_KEY");
if (!KEY) {
  console.error("GEMINI_API_KEY is missing in .env.local");
  process.exit(1);
}
const API = "https://generativelanguage.googleapis.com/v1beta";
const headers = { "Content-Type": "application/json", "x-goog-api-key": KEY };

const args = process.argv.slice(2);

if (args[0] === "--list") {
  const res = await fetch(`${API}/models?pageSize=200`, { headers });
  const body = await res.json();
  if (!res.ok) {
    console.error(res.status, JSON.stringify(body.error ?? body));
    process.exit(1);
  }
  const models = (body.models ?? []).filter((m) => /image/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes("generateContent"));
  for (const m of models) console.log(m.name.replace("models/", ""), "—", m.displayName);
  if (!models.length) console.log("No image models visible for this key.");
  process.exit(0);
}

const flag = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const model = flag("--model") ?? env("GEMINI_IMAGE_MODEL");
const ref = flag("--ref");
const aspect = flag("--aspect"); // e.g. 4:5 for product shots, 16:9 for the hero
const [prompt, out] = args;
if (!prompt || !out || !model) {
  console.error('Usage: node scripts/gen-image.mjs "<prompt>" <out.png> --model <id>   (or set GEMINI_IMAGE_MODEL; see --list)');
  process.exit(1);
}

const parts = [{ text: prompt }];
if (ref) {
  const mime = extname(ref).toLowerCase() === ".jpg" || extname(ref).toLowerCase() === ".jpeg" ? "image/jpeg" : "image/png";
  parts.push({ inlineData: { mimeType: mime, data: readFileSync(ref).toString("base64") } });
}

const res = await fetch(`${API}/models/${model}:generateContent`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"], ...(aspect && { imageConfig: { aspectRatio: aspect } }) },
  }),
});
const body = await res.json();
if (!res.ok) {
  console.error(res.status, JSON.stringify(body.error ?? body));
  process.exit(1);
}

const img = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
if (!img) {
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join(" ");
  console.error("No image returned.", body.candidates?.[0]?.finishReason ?? "", text ?? "");
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(img.inlineData.data, "base64"));
console.log(`saved ${out} (${img.inlineData.mimeType})`);
