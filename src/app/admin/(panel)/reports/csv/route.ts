import type { NextRequest } from "next/server";

import { ktmDay } from "@/lib/ktm-day";
import { ordersCsv } from "@/lib/reports";
import { currentStaff } from "@/lib/staff";

export async function GET(req: NextRequest) {
  const me = await currentStaff();
  if (!me || me.role !== "owner") return new Response("Owner sign-in needed.", { status: 403 });
  const days = Math.min(400, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
  const date = ktmDay();
  return new Response(await ordersCsv(days), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="easypick-orders-${days}d-${date}.csv"`, "Cache-Control": "no-store" },
  });
}
