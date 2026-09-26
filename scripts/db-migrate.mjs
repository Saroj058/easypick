// Applies the migrations in /drizzle to DATABASE_URL (the live database).
// Usage: npm run db:migrate   (reads DATABASE_URL from the shell or .env.local)
//
// Takes a PostgreSQL advisory lock first, so two runs at once (two deploys, a teammate)
// wait for each other instead of both migrating.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Any fixed number; only this script uses it. ("EZPK" in hex.)
const LOCK_KEY = 0x455a504b;
const WAIT_MS = 5 * 60_000;

let url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first (in .env.local, or run through `npm run db:migrate`).");
  process.exit(1);
}

// A lock belongs to one database session. Supabase's transaction pooler (port 6543) can hand
// each statement to a different session, so use its session pooler (port 5432) for this run.
try {
  const u = new URL(url);
  if (u.hostname.endsWith(".pooler.supabase.com") && u.port === "6543") {
    u.port = "5432";
    url = u.toString();
    console.log("Using Supabase's session pooler (port 5432) for the migration.");
  }
} catch {
  // not a URL we can read; use it as given
}

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
let locked = false;
try {
  const started = Date.now();
  for (;;) {
    const [row] = await client`select pg_try_advisory_lock(${LOCK_KEY}) as ok`;
    if (row.ok) break;
    if (Date.now() - started > WAIT_MS) throw new Error("Another migration has held the lock for 5 minutes. Check for a stuck run, then try again.");
    if (Date.now() - started < 2500) console.log("Another migration is running; waiting for it to finish…");
    await new Promise((r) => setTimeout(r, 2000));
  }
  locked = true;
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Database is up to date.");
} catch (e) {
  console.error("Migration failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  if (locked) await client`select pg_advisory_unlock(${LOCK_KEY})`.catch(() => {});
  await client.end();
}
