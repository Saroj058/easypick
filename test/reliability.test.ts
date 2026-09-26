import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { alertStaff } from "@/lib/alerts";
import { checkProductionEnv, databaseHost, isLocalDatabaseUrl, shouldAutoMigrate, shouldSeedSample } from "@/lib/env-check";
import { maskRecipient, notifyEmail, notifySms } from "@/lib/notify";

const LIVE = "postgresql://postgres.abc:secret-pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";
const LOCAL = "postgres://postgres:easypick-local@127.0.0.1:5433/easypick";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("database URL checks", () => {
  it("tells this machine from a hosted database", () => {
    expect(isLocalDatabaseUrl(LOCAL)).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u:p@localhost/db")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u:p@[::1]:5432/db")).toBe(true);
    expect(isLocalDatabaseUrl(LIVE)).toBe(false);
    expect(isLocalDatabaseUrl("postgres://u:p@db.internal:5432/db")).toBe(false);
    // Unreadable counts as remote: the safe side.
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
  });

  it("shows the host without the password", () => {
    expect(databaseHost(LIVE)).toBe("aws-0-ap-south-1.pooler.supabase.com");
    expect(databaseHost(LIVE)).not.toContain("secret");
  });

  it("migrates by itself only a local database in development, unless told to", () => {
    expect(shouldAutoMigrate({ NODE_ENV: "development", DATABASE_URL: LOCAL })).toBe(true);
    expect(shouldAutoMigrate({ NODE_ENV: "test", DATABASE_URL: LOCAL })).toBe(true);
    expect(shouldAutoMigrate({ NODE_ENV: "development", DATABASE_URL: LIVE })).toBe(false);
    expect(shouldAutoMigrate({ NODE_ENV: "production", DATABASE_URL: LIVE })).toBe(false);
    expect(shouldAutoMigrate({ NODE_ENV: "production", DATABASE_URL: LOCAL })).toBe(false);
    expect(shouldAutoMigrate({ NODE_ENV: "production", DATABASE_URL: LIVE, DB_AUTO_MIGRATE: "true" })).toBe(true);
    expect(shouldAutoMigrate({ NODE_ENV: "development", DATABASE_URL: LOCAL, DB_AUTO_MIGRATE: "false" })).toBe(false);
  });

  it("never fills the live database with sample products", () => {
    expect(shouldSeedSample({ NODE_ENV: "development", DATABASE_URL: LOCAL })).toBe(true);
    expect(shouldSeedSample({ NODE_ENV: "development", DATABASE_URL: LIVE })).toBe(false);
    expect(shouldSeedSample({ NODE_ENV: "production", DATABASE_URL: LIVE })).toBe(false);
    expect(shouldSeedSample({ NODE_ENV: "production", DATABASE_URL: LIVE, SEED_SAMPLE: "1" })).toBe(true);
  });
});

describe("production environment check", () => {
  const good = {
    NEXT_PUBLIC_SITE_URL: "https://easypick.com.np",
    SESSION_SECRET: "x".repeat(32),
    DATABASE_URL: LIVE,
    CRON_SECRET: "c",
    SMS_PROVIDER: "sparrow",
    SMS_TOKEN: "t",
    GMAIL_USER: "shop@gmail.com",
    GMAIL_APP_PASSWORD: "p",
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SECRET_KEY: "k",
  };

  it("passes a complete setup", () => {
    expect(checkProductionEnv(good)).toEqual({ errors: [], warnings: [] });
  });

  it("stops on a missing or local site URL, short session secret or no database", () => {
    for (const url of [undefined, "http://easypick.com.np", "https://localhost:3000", "nonsense"]) {
      expect(checkProductionEnv({ ...good, NEXT_PUBLIC_SITE_URL: url }).errors).toHaveLength(1);
    }
    expect(checkProductionEnv({ ...good, SESSION_SECRET: "short" }).errors[0]).toMatch(/SESSION_SECRET/);
    expect(checkProductionEnv({ ...good, DATABASE_URL: undefined }).errors[0]).toMatch(/DATABASE_URL/);
  });

  it("only warns about cron, SMS, email and photos", () => {
    const r = checkProductionEnv({ ...good, CRON_SECRET: "", SMS_PROVIDER: "", GMAIL_USER: "", SUPABASE_URL: "" });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/CRON_SECRET.*SMS.*email.*SUPABASE_URL/);
  });

  it("lets a Vercel preview run on its own address", () => {
    const r = checkProductionEnv({ ...good, NEXT_PUBLIC_SITE_URL: undefined, VERCEL_ENV: "preview", VERCEL_URL: "easypick-git-x.vercel.app" });
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toContain("https://easypick-git-x.vercel.app");
  });
});

describe("messages", () => {
  it("masks phone numbers and emails in logs", () => {
    expect(maskRecipient("9812345678")).toBe("98******78");
    expect(maskRecipient("anita@gmail.com")).toBe("an***@gmail.com");
    expect(maskRecipient("123")).toBe("***");
  });

  it("logs an SMS that can't be sent instead of dropping it silently", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMS_PROVIDER", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await notifySms("9812345678", "hello")).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/sms to 98\*{6}78 failed: SMS provider not configured/));
    expect(await notifySms(null, "hello")).toBe(false);
  });

  it("reports sent and failed emails", async () => {
    vi.stubEnv("GMAIL_USER", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await notifyEmail("a@b.com", "s", "<p>h</p>", "t")).toBe("sent"); // printed in development
    expect(await notifyEmail(null, "s", "h", "t")).toBe("skipped");
  });

  it("staff alerts never throw and say when nobody got them", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STAFF_ALERT_EMAIL", "");
    vi.stubEnv("GMAIL_USER", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await alertStaff("Test", "body")).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[staff alert, no STAFF_ALERT_EMAIL] Test"));
  });
});

describe("npm run db:migrate", () => {
  it("is safe to run twice at once", async () => {
    const run = promisify(execFile);
    const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL };
    const [a, b] = await Promise.all([
      run(process.execPath, ["scripts/db-migrate.mjs"], { env }),
      run(process.execPath, ["scripts/db-migrate.mjs"], { env }),
    ]);
    expect(a.stdout).toContain("Database is up to date.");
    expect(b.stdout).toContain("Database is up to date.");
  }, 60_000);
});
