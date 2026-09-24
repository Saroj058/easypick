import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { safeNext } from "@/lib/auth";
import { OAUTH_COOKIE, authorizeUrl, isConfigured, isProvider, newFlow } from "@/lib/oauth";

/** Starts "Continue with Google/Facebook": /api/auth/google?next=/checkout */
export async function GET(req: Request, ctx: RouteContext<"/api/auth/[provider]">) {
  const { provider } = await ctx.params;
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  if (!isProvider(provider)) redirect("/login");
  if (!isConfigured(provider)) redirect(`/login?error=${provider}_not_configured&next=${encodeURIComponent(next)}`);

  const { state, verifier, challenge } = newFlow();
  (await cookies()).set(OAUTH_COOKIE, JSON.stringify({ provider, state, verifier, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must survive the top-level redirect back from the provider
    path: "/api/auth",
    maxAge: 600,
  });
  redirect(authorizeUrl(provider, state, challenge));
}
