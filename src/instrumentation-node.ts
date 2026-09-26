// Node-only parts of instrumentation.ts (database, email). Loaded behind a NEXT_RUNTIME check so
// the edge bundle never includes them.

export async function checkEnvOnStart() {
  // `next build` loads this too; its environment isn't the running site's, so only check servers.
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { checkProductionEnv } = await import("./lib/env-check");
  // NEXT_PUBLIC_* are read by name so they match the values built into the pages.
  const { errors, warnings } = checkProductionEnv({
    ...process.env,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
  });
  for (const w of warnings) console.error(`[config] ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`[config] ${e}`);
    throw new Error(`Easypick can't start: ${errors.join(" ")}`);
  }
}

// One staff email per 10 minutes at most, however many errors: enough to know something's wrong.
const ALERT_WINDOW_MS = 10 * 60_000;
const g = globalThis as unknown as { __epLastErrorAlert?: number };

export async function alertOnError(subject: string, text: string) {
  if (process.env.NODE_ENV !== "production") return;
  try {
    if (!(await mayAlert())) return;
    const { alertStaff } = await import("./lib/alerts");
    await alertStaff(subject, text);
  } catch (e) {
    console.error("[instrumentation] couldn't alert staff", e); // never let reporting break anything
  }
}

/** Shared across servers through the rate_limits table; per server when the database itself is the problem. */
async function mayAlert(): Promise<boolean> {
  const now = Date.now();
  try {
    const { allow } = await import("./lib/rate-limit");
    return await allow("alert:server-error", 1, ALERT_WINDOW_MS);
  } catch {
    if (g.__epLastErrorAlert && now - g.__epLastErrorAlert < ALERT_WINDOW_MS) return false;
    g.__epLastErrorAlert = now;
    return true;
  }
}
