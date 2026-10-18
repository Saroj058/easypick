// The twelve kinds (owner, 18 Oct 2026): moves every piece saved under the old six kinds into the
// right one of the twelve, by its name, and fills thin kinds with placeholder pieces.
//
//   npm run catalogue:kinds              re-sort the pieces in DATABASE_URL (.env.local)
//   npm run catalogue:kinds -- --dry     only print what would change
//   npm run catalogue:kinds -- --demo    also add placeholder pieces so every kind has at least 12 live
//   npm run catalogue:kinds -- --remove-demo   delete those placeholders again (ids start "gen-cat-")
//
// Placeholders have no photos (the site draws them in their colour) and made-up prices and stock:
// replace them with real stock in the admin before launch.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first (run through `npm run catalogue:kinds`).");
  process.exit(1);
}
const args = new Set(process.argv.slice(2));

/** Same rules as categoryFor in src/lib/site.ts, plus the re-sorting of tops and layers. */
function kindOf(category, name) {
  const n = name.toLowerCase();
  if (category === "bottoms") {
    if (/jean|denim/.test(n)) return "jeans";
    if (/short/.test(n)) return "shorts";
    if (/jogger|cargo|track|parachute|sweatpant/.test(n)) return "joggers";
    return "trousers";
  }
  if (category === "tees" && /\bpolo\b/.test(n)) return "polos";
  if (category === "hoodies" && /crew|half-zip|quarter-zip/.test(n)) return "sweatshirts";
  if (category === "jackets" && /overshirt|shacket/.test(n)) return "shirts";
  return category;
}

const CODE = { tees: "TEE", shirts: "SHT", polos: "POL", hoodies: "HOD", sweatshirts: "SWT", jackets: "JKT", jeans: "JNS", trousers: "TRS", joggers: "JOG", shorts: "SHO", "co-ords": "COR", accessories: "ACC" };
const COLOURS = [
  ["Black", "#111111"], ["Bone", "#e8e2d6"], ["Olive", "#5b5f3a"], ["Ash", "#9a9a9a"], ["Navy", "#1f2a44"], ["Indigo", "#2e3a5c"],
  ["Rust", "#9b4a2b"], ["Sand", "#c9b28f"], ["Forest", "#2f4a36"], ["Charcoal", "#36383b"], ["Cream", "#f1eadb"], ["Maroon", "#5e1f24"],
  ["Sky", "#9cc3de"], ["Stone", "#b8b1a3"], ["Sage", "#9aa98a"], ["Mocha", "#6b4f3f"], ["Slate", "#5a6570"], ["Teal", "#1f5f63"],
].map(([name, hex]) => ({ name, hex }));
const SERIES = ["Everyday", "Washed", "Studio", "Kathmandu", "Himal", "Basecamp", "Thamel", "Patan", "Summit", "Valley", "Boudha", "Phewa"];
const KINDS = {
  tees: ["Heavy Tee", "Boxy Tee", "Pocket Tee"],
  shirts: ["Oxford Shirt", "Camp Collar Shirt", "Flannel Shirt", "Linen Shirt", "Denim Shirt", "Corduroy Shirt", "Poplin Shirt", "Work Shirt"],
  polos: ["Pique Polo", "Knit Polo", "Rugby Polo", "Zip Polo", "Long Sleeve Polo", "Waffle Polo", "Jersey Polo", "Pocket Polo"],
  hoodies: ["Pullover Hoodie", "Zip Hoodie", "Boxy Hoodie"],
  sweatshirts: ["Crewneck", "Quarter-Zip", "Half-Zip", "Fleece Crew", "Raglan Sweatshirt", "Mock Neck Sweatshirt"],
  jackets: ["Coach Jacket", "Bomber", "Windbreaker"],
  jeans: ["Straight Jean", "Baggy Jean", "Tapered Jean", "Carpenter Jean", "Wide Jean", "Black Jean"],
  trousers: ["Chino", "Pleated Trouser", "Carpenter Pant", "Linen Trouser", "Wide Trouser", "Drawstring Trouser"],
  joggers: ["Tapered Jogger", "Wide Cargo", "Track Pant", "Parachute Pant", "Fleece Jogger", "Nylon Cargo"],
  shorts: ["Sweat Short", "Cargo Short", "Nylon Short", "Denim Short", "Pleated Short", "Mesh Short", "Linen Short", "Chino Short"],
  "co-ords": ["Knit Set", "Washed Set", "Linen Set"],
  accessories: ["Six-Panel Cap", "Beanie", "Bucket Hat"],
};
const PRICE = { tees: 1299, shirts: 2299, polos: 1799, hoodies: 2799, sweatshirts: 2499, jackets: 4499, jeans: 2999, trousers: 2499, joggers: 2299, shorts: 1499, "co-ords": 3999, accessories: 799 };
const FABRIC = {
  shirts: "Brushed cotton twill", polos: "220 GSM cotton pique", sweatshirts: "350 GSM loopback cotton", jeans: "13 oz denim",
  trousers: "Stretch cotton twill", joggers: "Heavy cotton twill", shorts: "Washed cotton", tees: "240 GSM cotton jersey",
  hoodies: "400 GSM brushed fleece", jackets: "Water-resistant nylon shell", "co-ords": "Washed cotton twill", accessories: "Cotton twill",
};
const MIN_LIVE = 12;

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sizesFor = (c) => (c === "accessories" ? ["ONE"] : ["S", "M", "L", "XL"]);
const isBottom = (c) => ["jeans", "trousers", "joggers", "shorts"].includes(c);
const CHART = {
  top: { S: { chest: 108, length: 70, sleeve: 23 }, M: { chest: 114, length: 72, sleeve: 24 }, L: { chest: 120, length: 74, sleeve: 25 }, XL: { chest: 126, length: 76, sleeve: 26 } },
  bottom: { S: { waist: 70, length: 98, inseam: 72 }, M: { waist: 76, length: 100, inseam: 74 }, L: { waist: 82, length: 102, inseam: 76 }, XL: { waist: 88, length: 104, inseam: 77 } },
  short: { S: { waist: 70, length: 48 }, M: { waist: 76, length: 50 }, L: { waist: 82, length: 52 }, XL: { waist: 88, length: 54 } },
};

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
try {
  if (args.has("--remove-demo")) {
    const gone = await sql`delete from products where data->>'id' like 'gen-cat-%' returning slug`;
    console.log(`Removed ${gone.length} placeholder pieces.`);
    process.exit(0);
  }

  // 1. Re-sort what's there.
  const rows = await sql`select slug, status, data from products`;
  const moves = rows.map((r) => ({ slug: r.slug, from: r.data.category, to: kindOf(r.data.category, r.data.name), data: r.data })).filter((m) => m.from !== m.to);
  const tally = {};
  for (const m of moves) tally[`${m.from} → ${m.to}`] = (tally[`${m.from} → ${m.to}`] ?? 0) + 1;
  console.log(`${moves.length} of ${rows.length} pieces move:`, tally);

  // 2. What each kind would then have live (not the Vault).
  const live = {};
  for (const r of rows) {
    if (r.status !== "live" || r.data.vault) continue;
    const k = kindOf(r.data.category, r.data.name);
    live[k] = (live[k] ?? 0) + 1;
  }
  const short = Object.keys(CODE).map((k) => [k, Math.max(0, MIN_LIVE - (live[k] ?? 0))]).filter(([, n]) => n > 0);
  console.log("Live per kind:", Object.fromEntries(Object.keys(CODE).map((k) => [k, live[k] ?? 0])));
  if (args.has("--demo")) console.log("Placeholders to add:", Object.fromEntries(short));
  if (args.has("--dry")) process.exit(0);

  await sql.begin(async (tx) => {
    for (const m of moves) {
      const tags = (m.data.tags ?? []).map((t) => (t === m.from ? m.to : t));
      await tx`update products set data = jsonb_set(jsonb_set(data, '{category}', ${tx.json(m.to)}), '{tags}', ${tx.json(tags)}), updated_at = now() where slug = ${m.slug}`;
    }
  });
  console.log(`Moved ${moves.length} pieces.`);

  if (!args.has("--demo")) process.exit(0);

  // 3. Placeholders for thin kinds.
  const taken = new Set(rows.map((r) => r.slug));
  const [{ max }] = await sql`select coalesce(max(position), 0)::int as max from products`;
  let n = 0;
  let added = 0;
  await sql.begin(async (tx) => {
    for (const [kind, need] of short) {
      for (let i = 0; i < need; i++) {
        n++;
        const type = KINDS[kind][i % KINDS[kind].length];
        let name = `${SERIES[(n * 5) % SERIES.length]} ${type}`;
        for (let j = 2; taken.has(slugify(name)); j++) name = `${SERIES[(n * 5 + j) % SERIES.length]} ${type}`;
        taken.add(slugify(name));
        const colours = [COLOURS[(n * 7) % COLOURS.length], COLOURS[(n * 11 + 3) % COLOURS.length]].filter((c, x, a) => a.findIndex((y) => y.name === c.name) === x);
        const sizes = sizesFor(kind);
        const code = `${CODE[kind]}9${String(n).padStart(2, "0")}`;
        const price = PRICE[kind] + ((n * 300) % 900);
        // A few go on the festival offers, so those have something in them.
        const offer = n % 4 === 0 ? "dashain-offer" : n % 4 === 2 ? "tihar-offer" : null;
        const salePrice = offer ? Math.round((price * 0.8) / 100) * 100 - 1 : undefined;
        const fit = kind === "accessories" ? "regular" : ["oversized", "relaxed", "regular"][n % 3];
        const chart = kind === "accessories" ? {} : kind === "shorts" ? CHART.short : isBottom(kind) ? CHART.bottom : CHART.top;
        const p = {
          id: `gen-cat-${String(n).padStart(3, "0")}`,
          name,
          category: kind,
          gender: "unisex",
          fit,
          dropSlug: null,
          shortDescription: `${fit[0].toUpperCase() + fit.slice(1)} fit ${type.toLowerCase()} in ${FABRIC[kind].toLowerCase()}.`,
          details: [FABRIC[kind], kind === "accessories" ? "One size" : "Model is 178 cm and wears M.", "Machine wash cold, dry in the shade.", "Placeholder piece: price and stock are examples."],
          tags: [kind, fit, ...colours.map((c) => c.name.toLowerCase()), ...(offer ? ["offer", "sale", offer] : [])],
          colours,
          images: [{ src: null, alt: `${colours[0].name.toLowerCase()} ${name.toLowerCase()}, front view`, kind: "front" }],
          price,
          ...(salePrice ? { salePrice } : {}),
          measurements: chart,
          showOn: { website: true, kiosk: true },
          liveAt: new Date(Date.now() - n * 3_600_000).toISOString(),
        };
        const slug = slugify(name);
        await tx`insert into products (slug, status, position, data) values (${slug}, 'live', ${max + n}, ${tx.json(p)}) on conflict (slug) do nothing`;
        const variants = colours.flatMap((c) => sizes.map((size) => ({ sku: `${code}-${c.name.slice(0, 3).toUpperCase()}-${size}`, size, colour: c.name })));
        await tx`insert into variants ${tx(variants.map((v, x) => ({ sku: v.sku, product_slug: slug, size: v.size, colour: v.colour, stock: 2 + ((n + x) % 7), last_piece_on_floor: false, position: x })))} on conflict (sku) do nothing`;
        added++;
      }
    }
  });
  console.log(`Added ${added} placeholder pieces.`);
} finally {
  await sql.end();
}
