// Checks on the environment, kept free of Next and the database so they can be unit tested.
// Used by src/instrumentation.ts (start-up checks), src/lib/db (live-database guard)
// and mirrored in scripts/with-db.mjs.

type Env = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** The host name in a postgres:// URL, without the password. Null when it can't be read. */
export function databaseHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // No host means a Unix socket on this machine, e.g. postgres:///easypick.
    return u.hostname || "localhost";
  } catch {
    return null;
  }
}

/** True when DATABASE_URL points at this machine. Anything unreadable counts as remote (the safe side). */
export function isLocalDatabaseUrl(url: string | undefined): boolean {
  const host = databaseHost(url);
  return host !== null && LOCAL_HOSTS.has(host.toLowerCase());
}

/**
 * Whether the app may apply /drizzle migrations by itself on start.
 * Off in production and against a remote database (use `npm run db:migrate`),
 * unless DB_AUTO_MIGRATE=true. DB_AUTO_MIGRATE=false always turns it off.
 */
export function shouldAutoMigrate(env: Env): boolean {
  const flag = env.DB_AUTO_MIGRATE?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return env.NODE_ENV !== "production" && isLocalDatabaseUrl(env.DATABASE_URL);
}

/** Whether an empty database may be filled with the sample catalogue. Never the live one by accident. */
export function shouldSeedSample(env: Env): boolean {
  if (env.NODE_ENV === "production") return env.SEED_SAMPLE === "1";
  return isLocalDatabaseUrl(env.DATABASE_URL);
}

export interface EnvReport {
  /** The site can't work without these: start-up stops. */
  errors: string[];
  /** Features that won't work (texts, emails, photos, cron): logged loudly. */
  warnings: string[];
}

/** What's missing or wrong for a production server. `env` is process.env (with NEXT_PUBLIC_* as built). */
export function checkProductionEnv(env: Env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const preview = env.VERCEL_ENV === "preview";

  const siteUrl = env.NEXT_PUBLIC_SITE_URL?.trim();
  const siteProblem = siteUrlProblem(siteUrl);
  if (siteProblem) {
    // Preview deployments use their own *.vercel.app address (see site.ts).
    if (preview) warnings.push(`${siteProblem} (preview deployment: using https://${env.NEXT_PUBLIC_VERCEL_URL || env.VERCEL_URL || "?"} instead)`);
    else errors.push(siteProblem);
  }

  if ((env.SESSION_SECRET ?? "").length < 32) errors.push("SESSION_SECRET must be set to a random string of 32+ characters.");
  if (!env.DATABASE_URL) errors.push("DATABASE_URL isn't set.");

  if (!env.CRON_SECRET) warnings.push("CRON_SECRET isn't set: /api/cron refuses to run, so late payments and expired holds aren't handled.");
  const sms = env.SMS_PROVIDER?.toLowerCase();
  if (!((sms === "sparrow" || sms === "aakash") && env.SMS_TOKEN))
    warnings.push("No SMS provider (SMS_PROVIDER + SMS_TOKEN): login codes and order texts can't be sent.");
  const email = (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) || (env.RESEND_API_KEY && env.EMAIL_FROM);
  if (!email) warnings.push("No email provider (GMAIL_USER + GMAIL_APP_PASSWORD, or RESEND_API_KEY + EMAIL_FROM): gift emails and staff alerts can't be sent.");
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) warnings.push("SUPABASE_URL / SUPABASE_SECRET_KEY aren't set: product photo uploads won't work.");

  return { errors, warnings };
}

function siteUrlProblem(url: string | undefined): string | null {
  if (!url) return "NEXT_PUBLIC_SITE_URL isn't set (links in texts, emails and payment returns would point at localhost).";
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return `NEXT_PUBLIC_SITE_URL isn't a valid URL: ${url}`;
  }
  if (u.protocol !== "https:") return `NEXT_PUBLIC_SITE_URL must start with https:// (got ${url}).`;
  if (LOCAL_HOSTS.has(u.hostname.toLowerCase())) return `NEXT_PUBLIC_SITE_URL points at this machine (${url}), not the real domain.`;
  return null;
}
