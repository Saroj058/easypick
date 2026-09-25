import { ImageResponse } from "next/og";

import { formatPrice } from "@/lib/format";
import { INK, logo, OG_SIZE, photo, VOLT } from "@/lib/og";
import { site } from "@/lib/site";
import { getProduct } from "@/lib/store";

export const alt = `A piece from ${site.name}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProduct((await params).slug);
  const front = p?.images.find((i) => i.kind === "front") ?? p?.images[0];
  const img = await photo(front?.src);
  const price = p ? p.salePrice ?? p.price : 0;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f2f2ef" }}>
        <div style={{ width: 630, height: 630, display: "flex", alignItems: "center", justifyContent: "center", background: "#e9e9e4" }}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} width={630} height={630} alt="" style={{ objectFit: "cover" }} />
          ) : (
            <div style={{ fontSize: 44, color: "#6b6b66" }}>{p?.category ?? ""}</div>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 56, color: INK }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={await logo()} width={184} height={48} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.05, textTransform: "uppercase" }}>{p?.name ?? site.name}</div>
            {p && <div style={{ marginTop: 14, fontSize: 28, color: "#555" }}>{p.colours.map((c) => c.name).join(" · ")}</div>}
          </div>
          {p && (
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ background: VOLT, padding: "10px 20px", fontSize: 40, fontWeight: 700 }}>{formatPrice(price)}</div>
              {p.salePrice && <div style={{ fontSize: 30, color: "#777", textDecoration: "line-through" }}>{formatPrice(p.price)}</div>}
            </div>
          )}
        </div>
      </div>
    ),
    size,
  );
}
