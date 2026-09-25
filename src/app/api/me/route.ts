import { getCurrentUser } from "@/lib/auth";
import { currentStaff } from "@/lib/staff";

export const dynamic = "force-dynamic";

/**
 * Who's signed in, for client components (header, checkout prefill, fit sync).
 * Keeps pages statically cached instead of reading cookies on every render.
 */
export async function GET() {
  const user = await getCurrentUser();
  const body = user ? { user: { name: user.name, phone: user.phone ?? user.contactPhone ?? null, fit: user.fit, checkout: user.checkout ?? null, staff: Boolean(await currentStaff()) } } : { user: null };
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
