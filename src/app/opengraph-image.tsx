import { ImageResponse } from "next/og";

import { INK, logo, OG_SIZE, VOLT } from "@/lib/og";
import { site } from "@/lib/site";

export const alt = `${site.name}: ${site.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: INK, color: "#fff", padding: 72 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={await logo(true)} width={306} height={81} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1, letterSpacing: -2, textTransform: "uppercase" }}>{site.tagline}</div>
          <div style={{ marginTop: 28, fontSize: 34, color: "rgba(255,255,255,0.75)" }}>{site.subline}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28 }}>
          <div style={{ background: VOLT, color: INK, padding: "8px 18px", fontWeight: 700 }}>Kathmandu</div>
          <div style={{ color: "rgba(255,255,255,0.75)" }}>New drops every other Friday · Pay with eSewa</div>
        </div>
      </div>
    ),
    size,
  );
}
