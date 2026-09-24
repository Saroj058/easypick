import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { safeNext, signInWithProvider } from "@/lib/auth";
import { OAUTH_COOKIE, fetchProfile, isProvider } from "@/lib/oauth";

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The provider sends the person back here with ?code&state (or ?error). */
export async function GET(req: Request, ctx: RouteContext<"/api/auth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: "/api/auth" });

  let flow: { provider: string; state: string; verifier: string; next: string } | null = null;
  try {
    flow = raw ? JSON.parse(raw) : null;
  } catch {
    flow = null;
  }

  const next = safeNext(flow?.next);
  const fail = (why: string) => redirect(`/login?error=${why}&next=${encodeURIComponent(next)}`);

  if (!isProvider(provider) || !flow || flow.provider !== provider) fail("expired");
  if (url.searchParams.get("error")) fail("cancelled");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  if (!code || !same(state, flow!.state)) fail("expired");

  let isNew = false;
  let named = true;
  try {
    const profile = await fetchProfile(provider as "google" | "facebook", code!, flow!.verifier);
    const res = await signInWithProvider(profile);
    isNew = res.isNew;
    named = Boolean(res.user.name);
  } catch (e) {
    console.error("[oauth]", provider, e);
    fail("provider");
  }

  redirect(isNew || !named ? `/login/welcome?next=${encodeURIComponent(next)}` : next);
}
