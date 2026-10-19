"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, ImagePlus, Loader2, Plus, Ruler, Sparkles, Wand2, X } from "lucide-react";

import { addProduct } from "@/app/admin/actions";
import { addToLookAction, describePhotoAction } from "@/app/admin/add-actions";
import { uploadCutoutAction, uploadPhotoAction } from "@/app/admin/product-actions";
import { formatPrice } from "@/lib/format";
import { colourName, cropPhoto, cutOutPhoto, readPhoto, toHex, type Reading } from "@/lib/photo-magic";
import { typicalSizes } from "@/lib/typical-sizes";
import type { Category, Colour, Fit, Gender, ProductImage, Size } from "@/lib/types";

// ---------- Look ----------

const input = "mt-1.5 h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-[15px] outline-none focus:border-ink";
const field = "block text-[13px] font-semibold";
const hint = "font-normal text-[#6b6d72]";
const cell = "h-10 w-16 rounded-xl border border-ink/15 bg-white text-center font-mono outline-none focus:border-ink";
const pill = (on: boolean) => `inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ${on ? "bg-ink text-paper" : "bg-white ring-1 ring-ink/10 hover:ring-ink"}`;

const SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];
const SIZE_SETS: { label: string; sizes: Size[] }[] = [
  { label: "S–XL", sizes: ["S", "M", "L", "XL"] },
  { label: "XS–XXL", sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
  { label: "One size", sizes: ["ONE"] },
];
const KINDS: ProductImage["kind"][] = ["front", "back", "detail", "model", "styled"];
const KIND_NAME: Record<ProductImage["kind"], string> = { front: "Front", back: "Back", detail: "Close-up", model: "Worn", styled: "Styled" };
const MEASURES = [
  { key: "chest", label: "Chest" },
  { key: "length", label: "Length" },
  { key: "sleeve", label: "Sleeve" },
  { key: "waist", label: "Waist" },
  { key: "inseam", label: "Inseam" },
] as const;
const measuresFor = (c: string) => (c === "shorts" ? ["waist", "length"] : ["jeans", "trousers", "joggers"].includes(c) ? ["waist", "length", "inseam"] : c === "accessories" ? [] : ["chest", "length", "sleeve"]);
const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
const sizeName = (s: Size) => (s === "ONE" ? "One size" : s);
let ids = 0;

// ---------- Photos ----------

type Shot = {
  id: number;
  original: File;
  /** What gets uploaded: the auto-cropped photo, or the original made smaller. */
  file: File;
  url: string;
  kind: ProductImage["kind"];
  reading: (Reading & { width: number; height: number }) | null;
  cropped: File | null;
  auto: boolean;
};

/** Makes a big phone photo small enough to upload (1800 px, JPEG 85%), like the other photo forms. */
async function smaller(file: File): Promise<File> {
  const bm = await createImageBitmap(file).catch(() => null);
  if (!bm) return file;
  const s = Math.min(1, 1800 / Math.max(bm.width, bm.height));
  if (s === 1 && file.size < 2.5 * 1024 * 1024) return file;
  const c = document.createElement("canvas");
  c.width = Math.round(bm.width * s);
  c.height = Math.round(bm.height * s);
  c.getContext("2d")?.drawImage(bm, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}

/** A small copy for "Fill in from the photo" (quick to send, enough to see the piece). */
async function tiny(file: File): Promise<File | null> {
  const bm = await createImageBitmap(file).catch(() => null);
  if (!bm) return null;
  const s = Math.min(1, 640 / Math.max(bm.width, bm.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bm.width * s);
  c.height = Math.round(bm.height * s);
  c.getContext("2d")?.drawImage(bm, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.8));
  return blob ? new File([blob], "look.jpg", { type: "image/jpeg" }) : null;
}

/**
 * The photos turning like the piece on a stand: drag across (or use the arrows) to go round
 * front, side and back, with a slight 3D tilt as it turns.
 */
function Turntable({ shots, name }: { shots: Shot[]; name: string }) {
  const [at, setAt] = useState(0);
  const [tilt, setTilt] = useState(0);
  const drag = useRef<{ x: number; at: number } | null>(null);
  const n = shots.length;
  const i = n ? ((at % n) + n) % n : 0;
  const shot = shots[i];
  return (
    <div className="[perspective:900px]">
      <div
        role="img"
        aria-label={shot ? `${name || "New piece"}, ${KIND_NAME[shot.kind].toLowerCase()} (${i + 1} of ${n})` : "No photo yet"}
        tabIndex={n > 1 ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setAt((v) => v + 1);
          if (e.key === "ArrowLeft") setAt((v) => v - 1);
        }}
        onPointerDown={(e) => {
          if (n < 2) return;
          drag.current = { x: e.clientX, at };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          setAt(drag.current.at + Math.trunc(dx / 60));
          setTilt(Math.max(-16, Math.min(16, dx / 6)));
        }}
        onPointerUp={() => {
          drag.current = null;
          setTilt(0);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setTilt(0);
        }}
        style={{ transform: `rotateY(${tilt}deg)` }}
        className={`relative grid aspect-[4/5] touch-pan-y select-none place-items-center overflow-hidden rounded-[18px] bg-white outline-none transition-transform duration-300 ease-out focus-visible:ring-2 focus-visible:ring-ink ${n > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview of a picked photo
          <img src={shot.url} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[13px] text-[#8a8c91]">No photo yet</span>
        )}
        {n > 1 && (
          <>
            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[11px]">{KIND_NAME[shot.kind]}</span>
            <span className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1" aria-hidden>
              {shots.map((s, j) => (
                <span key={s.id} className={`h-1.5 rounded-full transition-all ${j === i ? "w-4 bg-ink" : "w-1.5 bg-ink/25"}`} />
              ))}
            </span>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="mt-2 flex items-center justify-between text-[12px] text-[#6b6d72]">
          <button type="button" onClick={() => setAt((v) => v - 1)} aria-label="Turn left" className="grid h-9 w-9 cursor-pointer place-items-center rounded-full hover:bg-white">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          Drag to turn it
          <button type="button" onClick={() => setAt((v) => v + 1)} aria-label="Turn right" className="grid h-9 w-9 cursor-pointer place-items-center rounded-full hover:bg-white">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

function Step({ n, id, title, note, children, aside }: { n: number; id: string; title: string; note?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28 rounded-[24px] bg-[#f4f4f2] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink font-mono text-[12px] font-semibold text-paper" aria-hidden>
            {n}
          </span>
          <div>
            <h2 id={`${id}-h`} className="text-[17px] font-semibold leading-7">
              {title}
            </h2>
            {note && <p className="text-[13.5px] text-[#55575c]">{note}</p>}
          </div>
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export type SmartPreset = { drop: string; vault: boolean; look: string; category: string };

/**
 * Add a piece, doing the work itself (owner, 19 Oct 2026: "the most advanced product add page, it
 * should auto do everything"): drop in the photos and each is cropped round the garment, the front
 * is lifted off its background for the rack and the fits, and its colour named; one tap fills the
 * words in from the photo; typical sizes fill the measurements; and one step puts it in the shop,
 * a drop, the Vault, a Designer Fit or an offer. Nothing is saved until "Add".
 */
export function SmartAddForm({
  kinds,
  drops,
  offers,
  fits,
  brands,
  preset,
  aiOn,
}: {
  kinds: { id: Category; label: string }[];
  drops: { slug: string; name: string; coming: boolean }[];
  offers: { tag: string; name: string }[];
  fits: { key: string; label: string }[];
  brands: string[];
  preset: SmartPreset;
  aiOn: boolean;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  const [shots, setShots] = useState<Shot[]>([]);
  const [working, setWorking] = useState(0);
  const [over, setOver] = useState(false);
  const [cutout, setCutout] = useState<{ file: File; url: string } | null>(null);
  const [useCutout, setUseCutout] = useState(true);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(kinds.some((k) => k.id === preset.category) ? preset.category : "tees");
  const [price, setPrice] = useState("");
  const [sale, setSale] = useState("");
  const [fit, setFit] = useState<Fit>("regular");
  const [gender, setGender] = useState<Gender>("unisex");
  const [line, setLine] = useState("");
  const [details, setDetails] = useState("");
  const [tags, setTags] = useState("");
  const [colours, setColours] = useState<Colour[]>([{ name: "Black", hex: "#111111" }]);
  const [coloursTouched, setColoursTouched] = useState(false);
  const [sizes, setSizes] = useState<Size[]>(["S", "M", "L", "XL"]);
  const [stock, setStock] = useState<Record<string, string>>({});
  const [fill, setFill] = useState("");
  const [measure, setMeasure] = useState<Record<string, string>>({});

  const [drop, setDrop] = useState(preset.drop);
  const [vault, setVault] = useState(preset.vault);
  const [brand, setBrand] = useState("");
  const [original, setOriginal] = useState(false);
  const [editionNo, setEditionNo] = useState("");
  const [editionOf, setEditionOf] = useState("");
  const [story, setStory] = useState("");
  const [look, setLook] = useState(preset.look);
  const [offerTags, setOfferTags] = useState<string[]>([]);
  const [website, setWebsite] = useState(true);
  const [kiosk, setKiosk] = useState(true);
  const [publish, setPublish] = useState(false);

  const [ai, setAi] = useState<{ busy: boolean; note: string; error: boolean }>({ busy: false, note: "", error: false });
  const [saving, setSaving] = useState<string>("");
  const [error, setError] = useState("");

  const shownSizes = SIZES.filter((s) => sizes.includes(s));
  const named = colours.filter((c) => c.name.trim());
  const total = named.reduce((n, c) => n + shownSizes.reduce((m, s) => m + (Number(stock[`${c.name.trim()}:${s}`]) || 0), 0), 0);
  const priceN = Number(price);
  const saleN = Number(sale);
  const measures = MEASURES.filter((m) => measuresFor(category).includes(m.key));
  const chosenDrop = drops.find((d) => d.slug === drop);

  // ----- Photos -----

  const addFiles = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, 12 - shots.length);
    if (!list.length) return;
    setWorking((w) => w + list.length);
    // First photo the front, the second the back, the rest close-ups (each can be changed).
    let index = shots.length;
    const hasBack = shots.some((s) => s.kind === "back");
    for (const original of list) {
      const reading = await readPhoto(original);
      const cropped = reading ? await cropPhoto(original, reading, slugOf(name) || "photo") : null;
      const file = cropped ?? (await smaller(original));
      const isFirst = index === 0;
      const kind: ProductImage["kind"] = index === 0 ? "front" : index === 1 && !hasBack ? "back" : "detail";
      index++;
      setShots((cur) => [...cur, { id: ++ids, original, file, url: URL.createObjectURL(file), kind, reading, cropped, auto: Boolean(cropped) }]);
      if (isFirst && reading) {
        // The front photo: lift the piece off its background, and read its colour.
        const cut = await cutOutPhoto(original, reading, "cutout");
        if (cut) setCutout({ file: cut, url: URL.createObjectURL(cut) });
        if (!coloursTouched) setColours([{ name: colourName(reading.colour), hex: toHex(reading.colour) }]);
      }
      setWorking((w) => w - 1);
    }
  };

  const setShot = (id: number, patch: Partial<Shot>) => setShots((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const toggleCrop = async (s: Shot) => {
    const auto = !s.auto;
    const file = auto && s.cropped ? s.cropped : await smaller(s.original);
    setShot(s.id, { auto, file, url: URL.createObjectURL(file) });
  };
  const moveShot = (from: number, to: number) =>
    setShots((cur) => {
      if (to < 0 || to >= cur.length) return cur;
      const next = [...cur];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });

  // ----- Fill in from the photo -----

  const fillFromPhoto = async () => {
    const front = shots[0];
    if (!front) return;
    setAi({ busy: true, note: "Looking at the photo…", error: false });
    const small = await tiny(front.file);
    if (!small) return setAi({ busy: false, note: "That photo couldn't be read.", error: true });
    const fd = new FormData();
    fd.set("photo", small);
    const r = await describePhotoAction(fd).catch(() => ({ ok: false as const, message: "Couldn't reach the helper. Try again." }));
    if (!r.ok) return setAi({ busy: false, note: r.message, error: true });
    const d = r.data;
    if (d.name) setName(d.name);
    if (d.category) setCategory(d.category);
    if (d.fit) setFit(d.fit);
    if (d.gender) setGender(d.gender);
    if (d.shortDescription) setLine(d.shortDescription);
    if (d.details?.length) setDetails(d.details.join("\n"));
    if (d.tags?.length) setTags(d.tags.join(", "));
    if (d.colour && !coloursTouched) setColours((cs) => cs.map((c, i) => (i === 0 ? { ...c, name: d.colour! } : c)));
    setAi({ busy: false, note: "Filled in from the photo. Check each field before adding.", error: false });
  };

  const fillTypical = () => {
    const t = typicalSizes(category as Category, fit, shownSizes);
    const next: Record<string, string> = {};
    for (const s of shownSizes) for (const m of measures) if (t[s]?.[m.key]) next[`${s}:${m.key}`] = String(t[s]![m.key]);
    setMeasure(next);
  };

  // ----- Colours -----

  const setColour = (i: number, patch: Partial<Colour>) => {
    setColoursTouched(true);
    setColours((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  };

  // ----- Save -----

  const checks: [string, boolean][] = [
    ["A photo", shots.length > 0],
    ["A name", Boolean(name.trim())],
    ["A price", priceN > 0],
    ["At least one colour", named.length > 0],
    ["At least one size", shownSizes.length > 0],
    ["Some stock", total > 0 || !publish],
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.current || saving) return;
    setError("");
    if (sale && !(saleN > 0 && saleN < priceN)) return setError("The sale price must be lower than the price.");
    if (vault && original && !brand.trim()) return setError("Add the brand before tagging it Original.");
    const fd = new FormData(form.current);
    fd.delete("pick");
    if (shots[0]) fd.set("photo", shots[0].file, shots[0].file.name);
    fd.set("photoKind", shots[0]?.kind ?? "front");
    fd.set("stay", "1");
    setSaving("Adding the piece…");
    const r = await addProduct({ status: "idle" }, fd).catch(() => ({ status: "error" as const, message: "Couldn't save just now. Check the connection and try again." }));
    if (r.status !== "saved" || !r.slug) {
      setSaving("");
      return setError(r.status === "error" ? r.message : "Couldn't save just now. Try again.");
    }
    const slug = r.slug;
    const problems: string[] = [];
    for (let i = 1; i < shots.length; i++) {
      setSaving(`Uploading photo ${i + 1} of ${shots.length}…`);
      const p = new FormData();
      p.set("slug", slug);
      p.set("kind", shots[i].kind);
      p.set("photo", shots[i].file, shots[i].file.name);
      const u = await uploadPhotoAction({ status: "idle" }, p).catch(() => ({ status: "error" as const, message: "upload failed" }));
      if (u.status === "error") problems.push(`photo ${i + 1}`);
    }
    if (cutout && useCutout) {
      setSaving("Adding the cut-out…");
      const c = new FormData();
      c.set("slug", slug);
      c.set("photo", cutout.file, cutout.file.name);
      const u = await uploadCutoutAction({ status: "idle" }, c).catch(() => ({ status: "error" as const, message: "" }));
      if (u.status === "error") problems.push("the cut-out");
    }
    if (look && named[0]) {
      setSaving("Putting it in the fit…");
      const l = await addToLookAction(slug, named[0].name.trim(), look).catch(() => ({ ok: false, message: "" }));
      if (!l.ok) problems.push("the fit");
    }
    router.push(`/admin/products/${slug}?added=${r.message === "scheduled" ? "scheduled" : "1"}${problems.length ? `&missed=${encodeURIComponent(problems.join(", "))}` : ""}`);
  };

  return (
    <form ref={form} onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="colours" value={JSON.stringify(colours)} />
      <input type="hidden" name="tags" value={tags} />
      {offerTags.map((t) => (
        <input key={t} type="hidden" name="offerTag" value={t} />
      ))}

      <div className="min-w-0 space-y-4">
        <nav aria-label="Steps" className="flex gap-1 overflow-x-auto rounded-full bg-[#f4f4f2] p-1 [scrollbar-width:none]">
          {[
            ["photos", "Photos"],
            ["piece", "The piece"],
            ["variants", "Colours & sizes"],
            ["stock", "Stock"],
            ["where", "Where it shows"],
          ].map(([id, l], i) => (
            <a key={id} href={`#${id}`} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] text-[#55575c] hover:bg-white hover:text-ink">
              <span className="font-mono text-[11px] text-[#8a8c91]">{i + 1}</span>
              {l}
            </a>
          ))}
        </nav>

        {/* 1. Photos */}
        <Step n={1} id="photos" title="Photos" note="Drop in all of them at once. Each is cropped round the piece; the first is the front.">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void addFiles(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink ${over ? "border-ink bg-white" : "border-ink/15 bg-white/60 hover:border-ink/40"}`}
          >
            {working ? <Loader2 className="h-6 w-6 animate-spin text-[#55575c]" aria-hidden /> : <ImagePlus className="h-6 w-6 text-[#8a8c91]" aria-hidden />}
            <span className="font-semibold">{working ? `Getting ${working === 1 ? "a photo" : `${working} photos`} ready…` : shots.length ? "Add more photos" : "Drop photos here, or tap to choose"}</span>
            <span className="text-[13px] text-[#6b6d72]">Front, back, close-ups, worn. Up to 12. JPG, PNG or WebP.</span>
            <input
              ref={picker}
              name="pick"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choose photos"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
              className="sr-only"
            />
          </label>

          {shots.length > 0 && (
            <ul aria-label="Photos" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {shots.map((s, i) => (
                <li key={s.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a picked photo */}
                    <img src={s.url} alt={`Photo ${i + 1}`} className="aspect-[4/5] w-full object-cover" />
                    {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper">Main</span>}
                  </div>
                  <div className="space-y-2 p-2">
                    <select aria-label={`Photo ${i + 1} is the`} value={s.kind} onChange={(e) => setShot(s.id, { kind: e.target.value as ProductImage["kind"] })} className="h-9 w-full rounded-lg border border-ink/15 bg-white px-2 text-[13px]">
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {KIND_NAME[k]}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center justify-between gap-1">
                      {s.cropped ? (
                        <button type="button" onClick={() => void toggleCrop(s)} aria-pressed={s.auto} className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ${s.auto ? "bg-ink text-paper" : "ring-1 ring-ink/15"}`}>
                          <Wand2 className="h-3.5 w-3.5" aria-hidden />
                          {s.auto ? "Cropped" : "As taken"}
                        </button>
                      ) : (
                        <span className="text-[11.5px] text-[#6b6d72]">As taken</span>
                      )}
                      <span className="flex">
                        <button type="button" disabled={i === 0} onClick={() => moveShot(i, i - 1)} aria-label={`Move photo ${i + 1} earlier`} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full hover:bg-[#f2f2f0] disabled:opacity-30">
                          <ArrowUp className="h-3.5 w-3.5 -rotate-90" aria-hidden />
                        </button>
                        <button type="button" disabled={i === shots.length - 1} onClick={() => moveShot(i, i + 1)} aria-label={`Move photo ${i + 1} later`} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full hover:bg-[#f2f2f0] disabled:opacity-30">
                          <ArrowDown className="h-3.5 w-3.5 -rotate-90" aria-hidden />
                        </button>
                        <button type="button" onClick={() => setShots((cur) => cur.filter((x) => x.id !== s.id))} aria-label={`Remove photo ${i + 1}`} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full hover:bg-[#f2f2f0]">
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {shots[0] && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr] sm:items-center">
              <div className="grid aspect-square place-items-center rounded-2xl bg-[linear-gradient(135deg,#eceae4,#f8f7f3)] p-2">
                {cutout ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local preview of the cut-out
                  <img src={cutout.url} alt="The piece cut out" className="max-h-full max-w-full object-contain [filter:drop-shadow(0_8px_10px_rgba(0,0,0,0.18))]" />
                ) : (
                  <span className="px-2 text-center text-[12px] text-[#6b6d72]">No cut-out</span>
                )}
              </div>
              <div className="text-[13.5px]">
                {cutout ? (
                  <>
                    <p className="font-semibold">Cut out for the rack and the fits</p>
                    <p className="text-[#55575c]">The home page rack and Designer Fits show the piece on its own like this.</p>
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={useCutout} onChange={(e) => setUseCutout(e.target.checked)} className="h-4 w-4 accent-[#0a0a0a]" />
                      Use this cut-out
                    </label>
                  </>
                ) : (
                  <p className="text-[#55575c]">The background isn&apos;t one plain colour, so the piece can&apos;t be cut out by itself. A flat-lay on a plain sheet works best; you can add a cut-out later under Photos.</p>
                )}
              </div>
            </div>
          )}
        </Step>

        {/* 2. The piece */}
        <Step
          n={2}
          id="piece"
          title="The piece"
          note="What it is and what it costs."
          aside={
            aiOn && shots.length > 0 ? (
              <button type="button" onClick={() => void fillFromPhoto()} disabled={ai.busy} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-ink px-4 text-[13.5px] font-semibold text-paper hover:bg-graphite disabled:opacity-60">
                {ai.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                Fill in from the photo
              </button>
            ) : undefined
          }
        >
          {ai.note && (
            <p role="status" className={`mb-4 rounded-xl px-3.5 py-2.5 text-[13.5px] ${ai.error ? "bg-[#fff1e0] text-[#7a3e00]" : "bg-white text-[#55575c]"}`}>
              {ai.note}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={field}>Name</span>
              <input name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Boxy Pocket Tee" className={input} />
              {slugOf(name) && <span className="mt-1 block font-mono text-[12px] text-[#6b6d72]">/product/{slugOf(name)}</span>}
            </label>
            <label className="block">
              <span className={field}>Category</span>
              <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                {kinds.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={field}>Price (Rs)</span>
                <input name="price" type="number" inputMode="numeric" min={1} required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1499" className={`${input} font-mono`} />
              </label>
              <label className="block">
                <span className={field}>
                  Sale <span className={hint}>(optional)</span>
                </span>
                <input name="salePrice" type="number" inputMode="numeric" min={1} value={sale} onChange={(e) => setSale(e.target.value)} placeholder="—" className={`${input} font-mono`} />
              </label>
            </div>
            <label className="block">
              <span className={field}>Fit</span>
              <select name="fit" value={fit} onChange={(e) => setFit(e.target.value as Fit)} className={input}>
                <option value="oversized">Oversized</option>
                <option value="relaxed">Relaxed</option>
                <option value="regular">Regular</option>
              </select>
            </label>
            <label className="block">
              <span className={field}>For</span>
              <select name="gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={input}>
                <option value="unisex">Everyone (unisex)</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={field}>One-line description</span>
              <input name="shortDescription" maxLength={300} value={line} onChange={(e) => setLine(e.target.value)} placeholder="Heavy cotton, boxy cut, one chest pocket." className={input} />
            </label>
            <label className="block sm:col-span-2">
              <span className={field}>
                Details <span className={hint}>(one per line: fabric, weight, care)</span>
              </span>
              <textarea name="details" rows={4} maxLength={4000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={"100% cotton, 240 GSM\nDropped shoulder\nWash cold, inside out"} className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-ink" />
            </label>
            <label className="block sm:col-span-2">
              <span className={field}>
                Search words <span className={hint}>(comma between, helps search find it)</span>
              </span>
              <input value={tags} onChange={(e) => setTags(e.target.value)} maxLength={200} placeholder="pocket, heavyweight, boxy" className={input} />
            </label>
          </div>
        </Step>

        {/* 3. Colours & sizes */}
        <Step n={3} id="variants" title="Colours & sizes" note="Each colour and size becomes its own code, like TEE12-BLA-M.">
          <ul className="space-y-2">
            {colours.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <input type="color" aria-label={`Colour ${i + 1} swatch`} value={c.hex} onChange={(e) => setColour(i, { hex: e.target.value })} className="h-11 w-11 shrink-0 cursor-pointer rounded-full border border-ink/15 bg-white p-1" />
                <input aria-label={`Colour ${i + 1} name`} value={c.name} onChange={(e) => setColour(i, { name: e.target.value })} maxLength={30} placeholder="Colour name" className="h-11 min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-4 outline-none focus:border-ink" />
                {colours.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setColoursTouched(true);
                      setColours((cs) => cs.filter((_, j) => j !== i));
                    }}
                    aria-label={`Remove ${c.name || `colour ${i + 1}`}`}
                    className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-[#55575c] hover:bg-white hover:text-ink"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {shots[0]?.reading && <p className="mt-2 text-[12.5px] text-[#6b6d72]">The first colour was read from the front photo.</p>}
          <button
            type="button"
            disabled={colours.length >= 20}
            onClick={() => {
              setColoursTouched(true);
              setColours((cs) => [...cs, { name: "", hex: "#888888" }]);
            }}
            className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-[13.5px] font-semibold hover:border-ink"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add a colour
          </button>

          <fieldset className="mt-6">
            <legend className="text-[13px] font-semibold">Sizes</legend>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {SIZES.map((s) => (
                <label key={s} className="relative cursor-pointer">
                  <input type="checkbox" name={`size:${s}`} checked={sizes.includes(s)} onChange={(e) => setSizes((cur) => (e.target.checked ? [...cur, s] : cur.filter((x) => x !== s)))} className="peer sr-only" />
                  <span className="flex h-10 min-w-12 items-center justify-center rounded-full bg-white px-3.5 font-mono text-[14px] ring-1 ring-ink/10 peer-checked:bg-ink peer-checked:text-paper peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                    {sizeName(s)}
                  </span>
                </label>
              ))}
              <span className="mx-1 h-5 w-px bg-ink/10" aria-hidden />
              {SIZE_SETS.map((set) => (
                <button key={set.label} type="button" onClick={() => setSizes(set.sizes)} className="h-10 cursor-pointer rounded-full px-3 text-[13px] text-[#55575c] underline-offset-2 hover:underline">
                  {set.label}
                </button>
              ))}
            </div>
          </fieldset>

          {measures.length > 0 && shownSizes.some((s) => s !== "ONE") && (
            <div className="mt-6 rounded-2xl bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">
                  Measurements in cm <span className={hint}>(optional; powers &ldquo;Your size in cm&rdquo;)</span>
                </p>
                <button type="button" onClick={fillTypical} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-ink/15 hover:ring-ink">
                  <Ruler className="h-4 w-4" aria-hidden />
                  Fill typical sizes
                </button>
              </div>
              {Object.keys(measure).length > 0 && <p className="mt-1 text-[12.5px] text-[#7a3e00]">Typical numbers: check them with a tape before putting it live.</p>}
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[360px] text-[15px]">
                  <thead className="text-[13px] text-[#6b6d72]">
                    <tr>
                      <th className="py-2 pr-3 text-left font-normal">Size</th>
                      {measures.map((m) => (
                        <th key={m.key} className="px-1 py-2 font-normal">
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shownSizes
                      .filter((s) => s !== "ONE")
                      .map((s) => (
                        <tr key={s}>
                          <th scope="row" className="py-1 pr-3 text-left font-mono font-normal">
                            {s}
                          </th>
                          {measures.map((m) => (
                            <td key={m.key} className="px-1 py-1">
                              <input
                                name={`m:${s}:${m.key}`}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                aria-label={`${s} ${m.label} in cm`}
                                value={measure[`${s}:${m.key}`] ?? ""}
                                onChange={(e) => setMeasure((cur) => ({ ...cur, [`${s}:${m.key}`]: e.target.value }))}
                                className={cell}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Step>

        {/* 4. Stock */}
        <Step n={4} id="stock" title="Starting stock" note="How many of each are tagged and on the rack. You can add more later.">
          {shownSizes.length > 0 && named.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="fill" className="text-[13.5px] text-[#55575c]">
                  Same number everywhere
                </label>
                <input id="fill" type="number" inputMode="numeric" min={0} value={fill} onChange={(e) => setFill(e.target.value)} placeholder="5" className={cell} />
                <button
                  type="button"
                  onClick={() => setStock(Object.fromEntries(named.flatMap((c) => shownSizes.map((s) => [`${c.name.trim()}:${s}`, fill || "0"]))))}
                  className="h-10 cursor-pointer rounded-full bg-white px-4 text-[13px] font-semibold ring-1 ring-ink/10 hover:ring-ink"
                >
                  Fill all
                </button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[360px] border-separate border-spacing-y-1.5 text-[15px]">
                  <thead className="text-[13px] text-[#6b6d72]">
                    <tr>
                      <th className="py-1 pl-3 pr-3 text-left font-normal">Colour</th>
                      {shownSizes.map((s) => (
                        <th key={s} className="px-1 py-1 font-normal">
                          {sizeName(s)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {named.map((c) => (
                      <tr key={c.name} className="bg-white [&>*:first-child]:rounded-l-2xl [&>*:last-child]:rounded-r-2xl">
                        <th scope="row" className="py-2 pl-3 pr-3 text-left font-normal">
                          <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} aria-hidden />
                            {c.name}
                          </span>
                        </th>
                        {shownSizes.map((s) => {
                          const k = `${c.name.trim()}:${s}`;
                          return (
                            <td key={s} className="px-1 py-2">
                              <input name={`stock:${c.name.trim()}:${s}`} type="number" inputMode="numeric" min={0} value={stock[k] ?? "0"} onChange={(e) => setStock((cur) => ({ ...cur, [k]: e.target.value }))} aria-label={`${c.name} ${s} stock`} className={cell} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-[14px] text-[#55575c]">Name a colour and tick a size first.</p>
          )}
        </Step>

        {/* 5. Where it shows */}
        <Step n={5} id="where" title="Where it shows" note="The shop always; and any of these.">
          <div className="space-y-3">
            <div className="rounded-2xl bg-white p-4">
              <p className="text-[14px] font-semibold">Shop</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <label className={pill(website)}>
                  <input type="checkbox" name="showWebsite" checked={website} onChange={(e) => setWebsite(e.target.checked)} className="sr-only" />
                  {website && <Check className="h-4 w-4" aria-hidden />}
                  Website
                </label>
                <label className={pill(kiosk)}>
                  <input type="checkbox" name="showKiosk" checked={kiosk} onChange={(e) => setKiosk(e.target.checked)} className="sr-only" />
                  {kiosk && <Check className="h-4 w-4" aria-hidden />}
                  In-store screen
                </label>
              </div>
            </div>

            <label className="block rounded-2xl bg-white p-4">
              <span className="text-[14px] font-semibold">Drop</span>
              <select name="drop" value={drop} onChange={(e) => setDrop(e.target.value)} className={input}>
                <option value="">Not part of a drop</option>
                {drops.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                    {d.coming ? " (coming)" : ""}
                  </option>
                ))}
              </select>
              {chosenDrop?.coming && <span className="mt-1.5 block text-[12.5px] text-[#55575c]">It waits for the drop and goes on sale when the drop lands.</span>}
            </label>

            <div className="rounded-2xl bg-white p-4">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="block text-[14px] font-semibold">The Vault</span>
                  <span className="block text-[12.5px] text-[#6b6d72]">Original brands, one of each.</span>
                </span>
                <input type="checkbox" name="vault" checked={vault} onChange={(e) => setVault(e.target.checked)} className="h-5 w-5 accent-[#0a0a0a]" />
              </label>
              {vault && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={field}>Brand</span>
                    <input name="brand" list="vault-brands" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={40} placeholder="Nike" className={input} />
                    <datalist id="vault-brands">
                      {brands.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className={field}>Piece no.</span>
                      <input name="editionNo" type="number" min={1} value={editionNo} onChange={(e) => setEditionNo(e.target.value)} className={`${input} font-mono`} />
                    </label>
                    <label className="block">
                      <span className={field}>Of how many</span>
                      <input name="editionOf" type="number" min={1} value={editionOf} onChange={(e) => setEditionOf(e.target.value)} className={`${input} font-mono`} />
                    </label>
                  </div>
                  <label className="block sm:col-span-2">
                    <span className={field}>Its story</span>
                    <textarea name="story" rows={2} maxLength={600} value={story} onChange={(e) => setStory(e.target.value)} className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-ink" />
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] sm:col-span-2">
                    <input type="checkbox" name="original" checked={original} onChange={(e) => setOriginal(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0a0a0a]" />
                    <span>
                      Tag it <b>Original</b> <span className="text-[#6b6d72]">— only with proof it came from the brand or an authorised seller.</span>
                    </span>
                  </label>
                </div>
              )}
            </div>

            <label className="block rounded-2xl bg-white p-4">
              <span className="text-[14px] font-semibold">Designer Fits</span>
              <select value={look} onChange={(e) => setLook(e.target.value)} className={input} aria-label="Add it to a fit">
                <option value="">Not in a fit</option>
                {fits.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-[12.5px] text-[#6b6d72]">Shown in the fit once the piece is live.</span>
            </label>

            {offers.length > 0 && (
              <div className="rounded-2xl bg-white p-4">
                <p className="text-[14px] font-semibold">Offers</p>
                <p className="text-[12.5px] text-[#6b6d72]">{sale ? "Its sale price joins these offers." : "Give it a sale price to join an offer."}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {offers.map((o) => {
                    const on = offerTags.includes(o.tag);
                    return (
                      <button key={o.tag} type="button" aria-pressed={on} onClick={() => setOfferTags((cur) => (on ? cur.filter((t) => t !== o.tag) : [...cur, o.tag]))} className={pill(on)}>
                        {on && <Check className="h-4 w-4" aria-hidden />}
                        {o.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-white p-4">
              <input type="checkbox" name="publish" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#0a0a0a]" />
              <span>
                <span className="font-semibold">Put it live now</span>
                <span className="block text-[13.5px] text-[#6b6d72]">Otherwise it&apos;s saved as a hidden draft{chosenDrop?.coming ? "; in a coming drop it waits for the drop either way" : ""}.</span>
              </span>
            </label>
          </div>
        </Step>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24" aria-label="Preview">
        <div className="rounded-[24px] bg-[#f4f4f2] p-2">
          <Turntable shots={shots} name={name} />
          <div className="px-3 pb-2 pt-3">
            <p className="truncate font-semibold">{name.trim() || "New piece"}</p>
            <p className="font-mono text-[14px]">
              {saleN > 0 && saleN < priceN ? (
                <>
                  {formatPrice(saleN)} <s className="text-[#8a8c91]">{formatPrice(priceN)}</s>
                </>
              ) : priceN > 0 ? (
                formatPrice(priceN)
              ) : (
                "Rs —"
              )}
            </p>
            <p className="mt-2 flex gap-1">
              {named.map((c) => (
                <span key={c.name} title={c.name} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
              ))}
            </p>
            <p className="mt-2 text-[12.5px] text-[#6b6d72]">
              {shownSizes.map(sizeName).join(" · ") || "No sizes"} · {total} in stock
            </p>
            <p className="mt-1 text-[12.5px] text-[#6b6d72]">{["Shop", chosenDrop?.name, vault ? "The Vault" : "", look ? "a fit" : "", offerTags.length ? "offers" : ""].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        <div className="rounded-[24px] bg-[#f4f4f2] p-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]">Ready?</p>
          <ul className="mt-3 space-y-2 text-[14px]">
            {checks.map(([l, ok]) => (
              <li key={l} className={`flex items-center gap-2.5 ${ok ? "" : "text-[#6b6d72]"}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full ${ok ? "bg-ink text-paper" : "ring-1 ring-ink/20"}`} aria-hidden>
                  {ok && <Check className="h-3 w-3" />}
                </span>
                {l}
                <span className="sr-only">{ok ? "done" : "not yet"}</span>
              </li>
            ))}
          </ul>
          <button type="submit" disabled={Boolean(saving) || working > 0} className="mt-5 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink text-[14.5px] font-semibold text-paper hover:bg-graphite disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {saving || (publish ? "Add and put live" : "Add product")}
          </button>
          <p role="alert" className="mt-2 text-[13.5px] text-[#d70015] empty:hidden">
            {error}
          </p>
        </div>
      </aside>
    </form>
  );
}
