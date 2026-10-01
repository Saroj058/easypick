// Adds a full demo range to the database: ~500 pieces across the core range and six drops,
// with sale prices on part of the range. Deterministic (same names, SKUs and stock every run)
// and safe to run twice (existing rows are left alone).
//
//   npm run catalogue:seed              add the range to DATABASE_URL (.env.local)
//   npm run catalogue:seed -- --dry     only print what would be added
//   npm run catalogue:seed -- --remove  delete every generated piece again (ids start "gen-")
//
// Generated pieces have no photos yet: the site draws each garment in its colour until
// real photos are uploaded in the admin.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first (run through `npm run catalogue:seed`).");
  process.exit(1);
}
const args = new Set(process.argv.slice(2));
const TOTAL = 500;

// Small seeded random number generator, so every run makes the same catalogue.
let seed = 20261002;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
/** Nepali shop prices end in 99 (e.g. 1,499). */
const price99 = (n) => Math.max(299, Math.round(n / 100) * 100 - 1);

const COLOURS = [
  ["Black", "#111111"], ["Bone", "#e8e2d6"], ["Olive", "#5b5f3a"], ["Ash", "#9a9a9a"], ["Navy", "#1f2a44"],
  ["Indigo", "#2e3a5c"], ["Rust", "#9b4a2b"], ["Sand", "#c9b28f"], ["Forest", "#2f4a36"], ["Charcoal", "#36383b"],
  ["Cream", "#f1eadb"], ["Maroon", "#5e1f24"], ["Sky", "#9cc3de"], ["Mustard", "#c99a2e"], ["Stone", "#b8b1a3"],
  ["Brick", "#8c3b2e"], ["Sage", "#9aa98a"], ["Mocha", "#6b4f3f"], ["Slate", "#5a6570"], ["Ivory", "#fbf7ee"],
  ["Plum", "#5a3450"], ["Teal", "#1f5f63"],
].map(([name, hex]) => ({ name, hex }));

const CHARTS = {
  tee: { S: { chest: 108, length: 70, sleeve: 23 }, M: { chest: 114, length: 72, sleeve: 24 }, L: { chest: 120, length: 74, sleeve: 25 }, XL: { chest: 126, length: 76, sleeve: 26 }, XXL: { chest: 132, length: 78, sleeve: 27 } },
  hoodie: { S: { chest: 116, length: 68, sleeve: 58 }, M: { chest: 122, length: 70, sleeve: 60 }, L: { chest: 128, length: 72, sleeve: 62 }, XL: { chest: 134, length: 74, sleeve: 63 }, XXL: { chest: 140, length: 76, sleeve: 64 } },
  jacket: { S: { chest: 118, length: 66, sleeve: 60 }, M: { chest: 124, length: 68, sleeve: 62 }, L: { chest: 130, length: 70, sleeve: 63 }, XL: { chest: 136, length: 72, sleeve: 64 } },
  bottom: { XS: { waist: 66, length: 96, inseam: 70 }, S: { waist: 70, length: 98, inseam: 72 }, M: { waist: 76, length: 100, inseam: 74 }, L: { waist: 82, length: 102, inseam: 76 }, XL: { waist: 88, length: 104, inseam: 77 } },
};

const TYPES = {
  tees: {
    code: "TEE", chart: "tee", price: [999, 1899], count: 150,
    kinds: ["Heavy Tee", "Boxy Tee", "Pocket Tee", "Graphic Tee", "Longline Tee", "Raglan Tee", "Ringer Tee", "Waffle Tee", "Henley", "Polo", "Long Sleeve Tee", "Baby Tee"],
    fabric: ["240 GSM cotton jersey", "220 GSM combed cotton", "Garment-dyed 250 GSM cotton", "Cotton-linen slub", "Waffle-knit cotton"],
  },
  hoodies: {
    code: "HOD", chart: "hoodie", price: [1999, 3499], count: 90,
    kinds: ["Pullover Hoodie", "Zip Hoodie", "Crewneck", "Half-Zip", "Fleece Crew", "Heavyweight Hoodie", "Boxy Hoodie", "Quarter-Zip"],
    fabric: ["400 GSM brushed fleece", "350 GSM loopback cotton", "Polar fleece", "Garment-dyed French terry"],
  },
  jackets: {
    code: "JKT", chart: "jacket", price: [2999, 6499], count: 70,
    kinds: ["Coach Jacket", "Bomber", "Denim Jacket", "Puffer", "Windbreaker", "Overshirt", "Shacket", "Varsity Jacket", "Harrington", "Field Jacket"],
    fabric: ["Water-resistant nylon shell", "12 oz rigid denim", "Brushed cotton twill", "Recycled polyester fill", "Wool-blend melton"],
  },
  bottoms: {
    code: "BTM", chart: "bottom", price: [1499, 3999], count: 110,
    kinds: ["Tapered Jogger", "Wide Cargo", "Straight Jean", "Baggy Jean", "Carpenter Pant", "Parachute Pant", "Chino", "Track Pant", "Sweat Short", "Cargo Short", "Pleated Trouser"],
    fabric: ["Heavy cotton twill", "13 oz denim", "Brushed fleece", "Ripstop nylon", "Stretch cotton"],
  },
  "co-ords": {
    code: "COR", chart: "tee", price: [2999, 4999], count: 35,
    kinds: ["Knit Set", "Washed Set", "Linen Set", "Track Set", "Fleece Set", "Waffle Set"],
    fabric: ["Washed cotton twill", "Cotton-linen blend", "Waffle knit", "Brushed fleece"],
  },
  accessories: {
    code: "ACC", chart: null, price: [399, 1499], count: 45,
    kinds: ["Six-Panel Cap", "Beanie", "Bucket Hat", "Tote Bag", "Crossbody Bag", "Socks 3-Pack", "Belt", "Bandana", "Trucker Cap"],
    fabric: ["Cotton twill", "Rib-knit acrylic", "Heavy canvas", "Nylon webbing"],
  },
};

const SERIES = ["Everyday", "Vintage", "Washed", "Heavyweight", "Essential", "Utility", "Studio", "Kathmandu", "Himal", "Monsoon", "Basecamp", "Thamel", "Patan", "Night", "Summit", "Valley", "Street", "Archive", "Core", "Bagmati", "Boudha", "Phewa", "Mustang", "Annapurna"];

// Six drops, every other Friday at 6 pm Kathmandu time. 01 and 02 already exist; their pieces are added to.
const DROPS = [
  { slug: "01", name: "Drop 01", story: "The everyday uniform. Heavy tees, easy joggers, one good jacket.", releaseAt: "2026-09-18T18:00:00+05:45", add: 60 },
  { slug: "02", name: "Drop 02", story: "Cooler evenings. Brushed fleece and layers for Dashain nights.", releaseAt: "2026-10-02T18:00:00+05:45", add: 50 },
  { slug: "03", name: "Drop 03", story: "Dashain edit. Clean sets and sharp jackets for visiting family.", releaseAt: "2026-10-16T18:00:00+05:45", add: 40 },
  { slug: "04", name: "Drop 04", story: "Tihar lights. Deep colours, soft knits, something new for the festival.", releaseAt: "2026-10-30T18:00:00+05:45", add: 40 },
  { slug: "05", name: "Drop 05", story: "First cold. Puffers, beanies and the heaviest hoodies we make.", releaseAt: "2026-11-13T18:00:00+05:45", add: 35 },
  { slug: "06", name: "Drop 06", story: "Winter archive. Washed colours and wide trousers to end the year.", releaseAt: "2026-11-27T18:00:00+05:45", add: 35 },
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function sizesFor(category) {
  if (category === "accessories") return ["ONE"];
  if (category === "bottoms") return rand() < 0.3 ? ["XS", "S", "M", "L", "XL"] : ["S", "M", "L", "XL"];
  return rand() < 0.35 ? ["S", "M", "L", "XL", "XXL"] : ["S", "M", "L", "XL"];
}

function stockFor(size) {
  const r = rand();
  if (r < 0.08) return 0;
  if (r < 0.2) return between(1, 2);
  return size === "M" || size === "L" ? between(4, 14) : between(2, 9);
}

/** The whole generated range, in a fixed order. */
function generate() {
  const products = [];
  const usedNames = new Set();
  const plan = Object.entries(TYPES).flatMap(([category, t]) => Array.from({ length: t.count }, () => category));
  // Shuffle so drops get a mix of categories.
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }
  const dropFor = [];
  for (const d of DROPS) for (let n = 0; n < d.add; n++) dropFor.push(d.slug);

  plan.slice(0, TOTAL).forEach((category, i) => {
    const t = TYPES[category];
    let name, kind;
    do {
      kind = pick(t.kinds);
      name = `${pick(SERIES)} ${kind}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const colourCount = category === "accessories" ? between(1, 2) : between(1, 3);
    const colours = [];
    while (colours.length < colourCount) {
      const c = pick(COLOURS);
      if (!colours.includes(c)) colours.push(c);
    }
    const sizes = sizesFor(category);
    const code = `${t.code}${String(101 + i).padStart(3, "0")}`;
    const variants = colours.flatMap((c) => sizes.map((size) => ({ sku: `${code}-${c.name.slice(0, 3).toUpperCase()}-${size}`, size, colour: c.name, stock: stockFor(size) })));

    const dropSlug = dropFor[i] ?? null;
    const upcoming = dropSlug && dropSlug !== "01";
    const price = price99(between(t.price[0], t.price[1]));
    // Offers: about 30% of the always-available range is marked down 15–35%.
    const onSale = !dropSlug && rand() < 0.3;
    const salePrice = onSale ? price99(price * (1 - between(15, 35) / 100)) : undefined;
    const soldOut = !upcoming && rand() < 0.05;
    if (soldOut) for (const v of variants) v.stock = 0;

    const fit = category === "accessories" ? "regular" : pick(["oversized", "relaxed", "regular"]);
    const fabric = pick(t.fabric);
    const chart = t.chart ? Object.fromEntries(sizes.filter((s) => CHARTS[t.chart][s]).map((s) => [s, CHARTS[t.chart][s]])) : {};
    const colourWord = colours[0].name.toLowerCase();
    const fitWord = fit[0].toUpperCase() + fit.slice(1);

    products.push({
      id: `gen-${String(i + 1).padStart(3, "0")}`,
      slug: slugify(name),
      name,
      category,
      gender: category === "co-ords" && rand() < 0.5 ? "women" : "unisex",
      fit,
      dropSlug,
      shortDescription:
        category === "accessories" ? `${kind} in ${fabric.toLowerCase()}. Made to be worn every day.` : `${fitWord} fit ${kind.toLowerCase()} in ${fabric.toLowerCase()}.`,
      details: [fabric, category === "accessories" ? "One size" : `${fitWord} fit. Model is 178 cm and wears M.`, "Machine wash cold, dry in the shade.", "Designed in Kathmandu."],
      tags: [category, fit, ...colours.map((c) => c.name.toLowerCase()), ...(onSale ? ["offer", "sale", i % 2 ? "dashain-offer" : "tihar-offer"] : [])],
      colours,
      images: [
        { src: null, alt: `${fit} ${colourWord} ${name.toLowerCase()}, front view`, kind: "front" },
        { src: null, alt: `${fit} ${colourWord} ${name.toLowerCase()}, back view`, kind: "back" },
      ],
      price,
      ...(salePrice ? { salePrice } : {}),
      measurements: chart,
      variants,
      status: upcoming ? "scheduled" : soldOut ? "sold_out" : "live",
      showOn: { website: true, kiosk: true },
    });
  });
  return products;
}

// ---------------------------------------------------------------------------------------------
// The Vault's demo pieces: six known brands, five pieces each, so the Vault section and page can
// be seen full before real stock arrives. They are placeholders: the prices and stock are made
// up, and none is tagged "Original" (that tag is the owner's to set, with proof, in the admin).
//
//   npm run catalogue:seed -- --vault            add them (ids start "gen-vlt-")
//   npm run catalogue:seed -- --vault --remove   delete only these again
// ---------------------------------------------------------------------------------------------
const VAULT_KINDS = {
  tee: { category: "tees", code: "TEE", chart: "tee", sizes: ["S", "M", "L", "XL"], fit: "regular", fabric: "Cotton jersey" },
  hoodie: { category: "hoodies", code: "HOD", chart: "hoodie", sizes: ["S", "M", "L", "XL"], fit: "regular", fabric: "Brushed fleece" },
  jacket: { category: "jackets", code: "JKT", chart: "jacket", sizes: ["S", "M", "L", "XL"], fit: "regular", fabric: "Woven shell" },
  pant: { category: "bottoms", code: "BTM", chart: "bottom", sizes: ["S", "M", "L", "XL"], fit: "regular", fabric: "Cotton blend" },
  cap: { category: "accessories", code: "ACC", chart: null, sizes: ["ONE"], fit: "regular", fabric: "Cotton twill" },
};
const C = (name) => COLOURS.find((c) => c.name === name);
// [model, kind, colour, price in NPR]
const VAULT = {
  Nike: [["Club Fleece Hoodie", "hoodie", "Black", 10999], ["Sportswear Tee", "tee", "Bone", 4999], ["Windrunner Jacket", "jacket", "Navy", 15999], ["Tech Fleece Jogger", "pant", "Charcoal", 12999], ["Heritage Cap", "cap", "Black", 3499]],
  Adidas: [["Trefoil Tee", "tee", "Cream", 4499], ["Firebird Track Jacket", "jacket", "Navy", 11999], ["Adicolor Hoodie", "hoodie", "Black", 9999], ["3-Stripes Track Pant", "pant", "Black", 8999], ["Trefoil Cap", "cap", "Navy", 2999]],
  "New Balance": [["Athletics Track Jacket", "jacket", "Navy", 13499], ["Essentials Tee", "tee", "Ash", 4499], ["Essentials Hoodie", "hoodie", "Stone", 10499], ["Athletics Jogger", "pant", "Slate", 8999], ["Classic Cap", "cap", "Cream", 2999]],
  Puma: [["T7 Track Jacket", "jacket", "Black", 9999], ["Essentials Tee", "tee", "Ivory", 3999], ["Classics Hoodie", "hoodie", "Forest", 8999], ["T7 Track Pant", "pant", "Black", 7999], ["Archive Cap", "cap", "Black", 2499]],
  Converse: [["Star Chevron Tee", "tee", "Black", 3999], ["Go-To Hoodie", "hoodie", "Cream", 8999], ["Coaches Jacket", "jacket", "Black", 10999], ["Carpenter Pant", "pant", "Sand", 8499], ["Tipoff Cap", "cap", "Maroon", 2499]],
  Carhartt: [["Detroit Jacket", "jacket", "Mocha", 19999], ["Pocket Tee", "tee", "Sand", 4999], ["Midweight Hoodie", "hoodie", "Forest", 11999], ["Double Knee Pant", "pant", "Mocha", 12999], ["Canvas Cap", "cap", "Sand", 3499]],
};

/** The Vault's demo pieces, in a fixed order. One or two of each size, as rare pieces would be. */
function generateVault() {
  let n = 0;
  return Object.entries(VAULT).flatMap(([brand, models]) =>
    models.map(([model, kindKey, colourName, price]) => {
      n++;
      const k = VAULT_KINDS[kindKey];
      const colour = C(colourName);
      const name = `${brand} ${model}`;
      const code = `VLT${String(n).padStart(3, "0")}`;
      // Deterministic small stock: mostly one of each size, now and then two or none.
      const stock = (i) => ((n * 7 + i * 3) % 9 === 0 ? 0 : (n + i) % 4 === 0 ? 2 : 1);
      return {
        id: `gen-vlt-${String(n).padStart(2, "0")}`,
        slug: slugify(name),
        name,
        category: k.category,
        gender: "unisex",
        fit: k.fit,
        dropSlug: null,
        shortDescription: `${model} by ${brand}, in ${colour.name.toLowerCase()}. A Vault piece.`,
        details: [k.fabric, k.sizes[0] === "ONE" ? "One size" : "Regular fit.", "Follow the care label.", "Demo piece: placeholder price and stock until real Vault stock is entered."],
        tags: [k.category, "vault", brand.toLowerCase(), colour.name.toLowerCase()],
        colours: [colour],
        images: [{ src: null, alt: `${colour.name.toLowerCase()} ${name.toLowerCase()}, front view`, kind: "front" }],
        price,
        measurements: k.chart ? Object.fromEntries(k.sizes.map((s) => [s, CHARTS[k.chart][s]])) : {},
        variants: k.sizes.map((size, i) => ({ sku: `${code}-${colour.name.slice(0, 3).toUpperCase()}-${size}`, size, colour: colour.name, stock: k.sizes[0] === "ONE" ? 2 : stock(i) })),
        status: "live",
        showOn: { website: true, kiosk: true },
        vault: true,
        brand,
      };
    }),
  );
}

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
try {
  if (args.has("--vault")) {
    if (args.has("--remove")) {
      const gone = await sql`delete from products where data->>'id' like 'gen-vlt-%' returning slug`;
      console.log(`Removed ${gone.length} Vault demo pieces.`);
    } else {
      const list = generateVault();
      console.log(`${list.length} Vault demo pieces across ${Object.keys(VAULT).length} brands, ${list.reduce((n, p) => n + p.variants.length, 0)} sizes.`);
      if (args.has("--dry")) process.exit(0);
      const taken = new Set((await sql`select slug from products`).map((r) => r.slug));
      const [{ max }] = await sql`select coalesce(max(position), 0)::int as max from products`;
      let added = 0;
      await sql.begin(async (tx) => {
        for (const [i, p] of list.entries()) {
          if (taken.has(p.slug)) continue;
          const { variants, slug, status, ...data } = p;
          await tx`insert into products (slug, status, position, data) values (${slug}, ${status}, ${max + 1 + i}, ${tx.json(data)}) on conflict (slug) do nothing`;
          await tx`insert into variants ${tx(variants.map((v, n) => ({ sku: v.sku, product_slug: slug, size: v.size, colour: v.colour, stock: v.stock, last_piece_on_floor: false, position: n })))} on conflict (sku) do nothing`;
          added++;
        }
      });
      console.log(`Added ${added} Vault demo pieces (${list.length - added} were already there).`);
    }
  } else if (args.has("--remove")) {
    const gone = await sql`delete from products where data->>'id' like 'gen-%' returning slug`;
    await sql`delete from drops where slug in ('03','04','05','06') and not exists (select 1 from products where data->>'dropSlug' = drops.slug)`;
    console.log(`Removed ${gone.length} generated pieces.`);
  } else {
    const list = generate();
    const bySale = list.filter((p) => p.salePrice).length;
    const byDrop = Object.fromEntries(DROPS.map((d) => [d.slug, list.filter((p) => p.dropSlug === d.slug).length]));
    console.log(`${list.length} pieces: ${list.filter((p) => !p.dropSlug).length} core range, drops ${JSON.stringify(byDrop)}, ${bySale} on sale, ${list.filter((p) => p.status === "sold_out").length} sold out, ${list.reduce((n, p) => n + p.variants.length, 0)} sizes.`);
    if (args.has("--dry")) process.exit(0);

    const taken = new Set((await sql`select slug from products`).map((r) => r.slug));
    const [{ max }] = await sql`select coalesce(max(position), 0)::int as max from products`;
    let added = 0;
    await sql.begin(async (tx) => {
      for (const d of DROPS) {
        await tx`insert into drops (slug, name, story, release_at, piece_count) values (${d.slug}, ${d.name}, ${d.story}, ${d.releaseAt}, 0) on conflict (slug) do nothing`;
      }
      for (const [i, p] of list.entries()) {
        if (taken.has(p.slug)) continue;
        const { variants, slug, status, ...data } = p;
        await tx`insert into products (slug, status, position, data) values (${slug}, ${status}, ${max + 1 + i}, ${tx.json(data)}) on conflict (slug) do nothing`;
        await tx`insert into variants ${tx(variants.map((v, n) => ({ sku: v.sku, product_slug: slug, size: v.size, colour: v.colour, stock: v.stock, last_piece_on_floor: false, position: n })))} on conflict (sku) do nothing`;
        added++;
      }
      // Each drop's piece count: everything its pieces started with.
      for (const d of DROPS) {
        await tx`update drops set piece_count = (select coalesce(sum(v.stock), 0) from variants v join products p on p.slug = v.product_slug where p.data->>'dropSlug' = ${d.slug}) where slug = ${d.slug}`;
      }
    });
    console.log(`Added ${added} pieces (${list.length - added} were already there).`);
  }
} finally {
  await sql.end();
}
