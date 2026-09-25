import { ImageResponse } from "next/og";

import { formatDropTime } from "@/lib/format";
import { INK, logo, OG_SIZE, VOLT } from "@/lib/og";
import { site } from "@/lib/site";
import { getDrop } from "@/lib/store";

export const alt = `A drop from ${site.name}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const d = await getDrop((await params).slug);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: INK, color: "#fff", padding: 72 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={await logo(true)} width={306} height={81} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 150, fontWeight: 700, lineHeight: 0.95, textTransform: "uppercase", color: VOLT }}>{d?.name ?? "New drop"}</div>
          {d?.story && <div style={{ marginTop: 24, fontSize: 32, color: "rgba(255,255,255,0.8)", maxWidth: 1000 }}>{d.story.slice(0, 140)}</div>}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,0.8)" }}>
          {d ? `${formatDropTime(d.releaseAt)} · ${d.pieceCount} pieces · Kathmandu` : "Kathmandu"}
        </div>
      </div>
    ),
    size,
  );
}
