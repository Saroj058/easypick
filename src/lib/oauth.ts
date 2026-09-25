import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { ProviderProfile } from "./auth";
import { site } from "./site";

// "Continue with Google / Facebook" using the standard OAuth 2.0 code flow.
// Keys come from .env.local (see .env.example). A provider without keys stays
// visible on the login page but explains it isn't set up yet.

export type Provider = "google" | "facebook";
export const PROVIDERS: Provider[] = ["google", "facebook"];
export const OAUTH_COOKIE = "ep_oauth";

const FB_VERSION = process.env.FACEBOOK_GRAPH_VERSION ?? "v21.0";

const config = {
  google: { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET },
  facebook: { id: process.env.FACEBOOK_APP_ID, secret: process.env.FACEBOOK_APP_SECRET },
};

export function isProvider(v: string): v is Provider {
  return (PROVIDERS as string[]).includes(v);
}

export function isConfigured(p: Provider) {
  return Boolean(config[p].id && config[p].secret);
}

export function redirectUri(p: Provider) {
  return `${site.url}/api/auth/${p}/callback`;
}

export function newFlow() {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge };
}

export function authorizeUrl(p: Provider, state: string, challenge: string) {
  if (p === "google") {
    const q = new URLSearchParams({
      client_id: config.google.id!,
      redirect_uri: redirectUri(p),
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  const q = new URLSearchParams({
    client_id: config.facebook.id!,
    redirect_uri: redirectUri(p),
    response_type: "code",
    scope: "email,public_profile",
    state,
  });
  return `https://www.facebook.com/${FB_VERSION}/dialog/oauth?${q}`;
}

/** Swap the callback code for the user's profile. Throws on any failure. */
export async function fetchProfile(p: Provider, code: string, verifier: string): Promise<ProviderProfile> {
  if (p === "google") {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", { signal: AbortSignal.timeout(10_000),
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.google.id!,
        client_secret: config.google.secret!,
        redirect_uri: redirectUri(p),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!tokenRes.ok) throw new Error(`google token ${tokenRes.status}`);
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${access_token}` } });
    if (!infoRes.ok) throw new Error(`google userinfo ${infoRes.status}`);
    const info = (await infoRes.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
    return { provider: "google", id: info.sub, email: info.email ?? null, emailVerified: Boolean(info.email_verified), name: info.name ?? null };
  }

  const tq = new URLSearchParams({
    client_id: config.facebook.id!,
    client_secret: config.facebook.secret!,
    redirect_uri: redirectUri(p),
    code,
  });
  const tokenRes = await fetch(`https://graph.facebook.com/${FB_VERSION}/oauth/access_token?${tq}`, { signal: AbortSignal.timeout(10_000) });
  if (!tokenRes.ok) throw new Error(`facebook token ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const meRes = await fetch(`https://graph.facebook.com/${FB_VERSION}/me?${new URLSearchParams({ fields: "id,name,email", access_token })}`, { signal: AbortSignal.timeout(10_000) });
  if (!meRes.ok) throw new Error(`facebook me ${meRes.status}`);
  const me = (await meRes.json()) as { id: string; name?: string; email?: string };
  // Facebook only returns an email the person has confirmed with Facebook.
  return { provider: "facebook", id: me.id, email: me.email ?? null, emailVerified: Boolean(me.email), name: me.name ?? null };
}
