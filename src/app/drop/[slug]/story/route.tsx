import { ImageResponse } from "next/og";

import { formatDropTime } from "@/lib/format";
import { INK, logo, VOLT } from "@/lib/og";
import { getDrop, isReleased } from "@/lib/store";

export const revalidate = 300;

/** A tall 1080×1920 image of a drop, the shape of an Instagram or TikTok story. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const d = await getDrop((await params).slug);
  if (!d) return new Response("Not found", { status: 404 });
  const out = isReleased(d);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: INK, color: "#fff", padding: "140px 80px 180px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={await logo(true)} width={340} height={90} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 34, letterSpacing: 6, color: "rgba(255,255,255,0.7)" }}>{out ? "OUT NOW" : "ARRIVES"}</div>
          <div style={{ display: "flex", fontSize: 560, fontWeight: 700, lineHeight: 0.82, color: VOLT, marginTop: 20 }}>{d.slug}</div>
          <div style={{ display: "flex", fontSize: 110, fontWeight: 700, textTransform: "uppercase", lineHeight: 1, marginTop: 30 }}>{d.name}</div>
          {d.story && <div style={{ display: "flex", marginTop: 36, fontSize: 40, lineHeight: 1.35, color: "rgba(255,255,255,0.8)" }}>{d.story.slice(0, 120)}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 40, color: "rgba(255,255,255,0.85)" }}>
          <div style={{ display: "flex" }}>{formatDropTime(d.releaseAt)}</div>
          <div style={{ display: "flex", marginTop: 12, color: "rgba(255,255,255,0.6)" }}>{d.pieceCount} pieces · price on every tag · Kathmandu</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
