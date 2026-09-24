import Image from "next/image";

import type { Category, ProductImage as Img } from "@/lib/types";

// Until real photos exist, products render as a technical flat: the garment in its
// own colour with seams, stitching and trims drawn in. Real photos replace this
// automatically once `src` is set.

type Garment = {
  body: string;
  /** Soft fold shadow under arms / down side seams. */
  shade: string;
  /** Solid construction seams. */
  seams: string[];
  /** Dashed topstitching. */
  stitch: string[];
  /** Small round trims: buttons, eyelets, snaps. [cx, cy, r] */
  dots?: [number, number, number][];
  back: { seams: string[]; stitch: string[]; dots?: [number, number, number][] };
};

const garments: Record<Category, Garment> = {
  tees: {
    body: "M70 40 L100 28 Q120 44 140 28 L170 40 L200 80 L172 96 L166 84 L168 196 Q120 202 72 196 L74 84 L68 96 L40 80 Z",
    shade: "M74 84 L86 92 L84 197 L72 196 Z M166 84 L154 92 L156 197 L168 196 Z",
    seams: ["M70 40 Q77 62 74 84", "M170 40 Q163 62 166 84", "M104 31 Q120 47 136 31"],
    stitch: ["M47 77 L72 91", "M193 77 L168 91", "M74 188 Q120 194 166 188"],
    back: {
      seams: ["M70 40 Q77 62 74 84", "M170 40 Q163 62 166 84", "M104 31 Q120 38 136 31"],
      stitch: ["M47 77 L72 91", "M193 77 L168 91", "M74 188 Q120 194 166 188", "M113 36 h14 v8 h-14 Z"],
    },
  },
  hoodies: {
    body: "M72 48 Q84 12 120 12 Q156 12 168 48 L184 56 L208 176 L184 182 L166 96 L168 200 Q120 206 72 200 L74 96 L56 182 L32 176 L56 56 Z",
    shade: "M74 96 L88 104 L86 201 L72 200 Z M166 96 L152 104 L154 201 L168 200 Z",
    seams: ["M72 48 Q79 72 74 96", "M168 48 Q161 72 166 96", "M94 54 Q120 76 146 54", "M88 152 L98 124 L142 124 L152 152 L152 184 L88 184 Z"],
    stitch: ["M36 164 L58 170", "M182 170 L204 164", "M74 190 Q120 196 166 190", "M111 66 L109 92", "M129 66 L131 92"],
    dots: [
      [111, 64, 2],
      [129, 64, 2],
    ],
    back: {
      seams: ["M72 48 Q79 72 74 96", "M168 48 Q161 72 166 96", "M120 14 L120 58", "M84 50 Q120 80 156 50"],
      stitch: ["M36 164 L58 170", "M182 170 L204 164", "M74 190 Q120 196 166 190"],
    },
  },
  jackets: {
    body: "M74 36 L104 26 L120 40 L136 26 L166 36 L184 50 L206 178 L182 184 L166 96 L166 200 L74 200 L74 96 L58 184 L34 178 L56 50 Z",
    shade: "M74 96 L88 104 L88 200 L74 200 Z M166 96 L152 104 L152 200 L166 200 Z",
    seams: ["M104 26 L112 50 L120 40 L128 50 L136 26", "M120 40 L120 200", "M74 36 Q80 66 74 96", "M166 36 Q160 66 166 96", "M134 84 L156 84 L156 100 L134 100 Z"],
    stitch: ["M38 168 L60 174", "M180 174 L202 168", "M74 190 L166 190"],
    dots: [
      [125, 64, 2.2],
      [125, 94, 2.2],
      [125, 124, 2.2],
      [125, 154, 2.2],
      [125, 182, 2.2],
    ],
    back: {
      seams: ["M104 26 Q120 34 136 26", "M74 70 L166 70", "M74 36 Q80 66 74 96", "M166 36 Q160 66 166 96"],
      stitch: ["M38 168 L60 174", "M180 174 L202 168", "M74 190 L166 190"],
    },
  },
  bottoms: {
    body: "M80 20 L160 20 L166 60 L176 208 L132 208 L120 84 L108 208 L64 208 L74 60 Z",
    shade: "M120 84 L126 110 L132 208 L124 208 Z M74 60 L82 70 L72 208 L64 208 Z",
    seams: ["M79 32 L161 32", "M86 32 Q98 44 76 64", "M154 32 Q142 44 164 64"],
    stitch: ["M120 32 L120 66 Q120 76 110 78", "M66 198 L108 198", "M132 198 L174 198"],
    dots: [[120, 26, 2.2]],
    back: {
      seams: ["M79 32 L161 32", "M78 44 L120 52 L162 44", "M88 58 L110 58 L110 78 L99 84 L88 78 Z", "M130 58 L152 58 L152 78 L141 84 L130 78 Z"],
      stitch: ["M66 198 L108 198", "M132 198 L174 198", "M92 20 L92 32", "M148 20 L148 32"],
    },
  },
  "co-ords": {
    body: "M74 20 L104 12 Q120 22 136 12 L166 20 L190 52 L170 64 L164 56 L164 120 L76 120 L76 56 L70 64 L50 52 Z M78 130 L162 130 L168 206 L128 206 L120 160 L112 206 L72 206 Z",
    shade: "M76 56 L86 62 L86 120 L76 120 Z M164 56 L154 62 L154 120 L164 120 Z",
    seams: ["M104 12 L112 30 L120 22 L128 30 L136 12", "M120 22 L120 120", "M78 142 L162 142"],
    stitch: ["M56 54 L72 62", "M184 54 L168 62", "M76 112 L164 112", "M72 198 L112 198", "M128 198 L168 198"],
    dots: [
      [124, 44, 2],
      [124, 66, 2],
      [124, 88, 2],
    ],
    back: {
      seams: ["M104 12 Q120 20 136 12", "M76 40 L164 40", "M78 142 L162 142"],
      stitch: ["M56 54 L72 62", "M184 54 L168 62", "M76 112 L164 112", "M72 198 L112 198", "M128 198 L168 198"],
    },
  },
  accessories: {
    body: "M60 140 Q60 72 120 72 Q180 72 180 140 L200 140 Q206 158 186 158 L60 158 Z",
    shade: "M60 140 Q62 104 84 86 Q72 112 74 140 Z",
    seams: ["M120 74 L120 140", "M92 80 Q100 110 96 140", "M148 80 Q140 110 144 140"],
    stitch: ["M150 150 L196 150", "M64 134 L176 134"],
    dots: [[120, 73, 3.2]],
    back: {
      seams: ["M120 74 L120 118", "M92 80 Q100 110 96 140", "M148 80 Q140 110 144 140"],
      stitch: ["M64 134 L176 134"],
      dots: [[120, 73, 3.2]],
    },
  },
};

/** Line colour that stays visible on both black and bone garments. */
function lineColour(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.35 ? { line: "rgba(255,255,255,0.28)", shade: "rgba(255,255,255,0.05)" } : { line: "rgba(0,0,0,0.26)", shade: "rgba(0,0,0,0.06)" };
}

export function GarmentSvg({
  category,
  colourHex,
  view = "front",
  className = "",
  style,
}: {
  category: Category;
  colourHex: string;
  view?: "front" | "back";
  className?: string;
  style?: React.CSSProperties;
}) {
  const g = garments[category];
  const d = view === "back" ? g.back : g;
  const c = lineColour(colourHex);
  return (
    <svg viewBox="0 0 240 230" className={className} style={style} aria-hidden>
      <path d={g.body} fill={colourHex} stroke="rgba(0,0,0,0.14)" strokeWidth="1" strokeLinejoin="round" />
      <path d={g.shade} fill={c.shade} />
      <g fill="none" stroke={c.line} strokeLinecap="round" strokeLinejoin="round">
        {d.seams.map((p) => (
          <path key={p} d={p} strokeWidth="1" />
        ))}
        {d.stitch.map((p) => (
          <path key={p} d={p} strokeWidth="0.9" strokeDasharray="2.5 2" />
        ))}
      </g>
      {(d.dots ?? g.dots)?.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="none" stroke={c.line} strokeWidth="1" />
      ))}
    </svg>
  );
}

export function ProductImage({
  image,
  category,
  colourHex,
  priority,
  decorative = false,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  className = "",
}: {
  image: Img;
  category: Category;
  colourHex: string;
  priority?: boolean;
  /** Inside a link that already names the product: hide from screen readers. */
  decorative?: boolean;
  sizes?: string;
  className?: string;
}) {
  if (image.src) {
    return (
      <div className={`relative aspect-[4/5] overflow-hidden bg-photo ${className}`}>
        <Image src={image.src} alt={decorative ? "" : image.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }

  const zoom = image.kind === "detail" ? "scale(2.4) translate(-8%, -4%)" : image.kind === "model" ? "scale(0.82)" : undefined;
  const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": image.alt };

  return (
    <div {...a11y} className={`relative aspect-[4/5] overflow-hidden bg-photo shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] ${className}`}>
      {image.kind === "model" && <div className="absolute inset-x-0 bottom-0 h-1/4 bg-mist/60" />}
      <GarmentSvg
        category={category}
        colourHex={colourHex}
        view={image.kind === "back" ? "back" : "front"}
        className="absolute inset-0 m-auto h-[66%] w-[66%]"
        style={zoom ? { transform: zoom } : undefined}
      />
    </div>
  );
}
