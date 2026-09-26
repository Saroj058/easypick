// Runs a command (next dev / build / start) with a database behind it.
//
//   DATABASE_URL set (in the shell or .env.local) → just runs the command against it.
//   Not set → starts a real PostgreSQL server from the embedded-postgres package
//             (binaries come with `npm install`, nothing else to install), stored in
//             .data/postgres, on 127.0.0.1:5433, and points the command at it.
//
//   --local → always the local PostgreSQL, even when DATABASE_URL is set (offline work).
//
// Usage: node scripts/with-db.mjs [--local] next dev
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const local = process.argv[2] === "--local";
const cmd = process.argv.slice(local ? 3 : 2);
if (!cmd.length) {
  console.error("Usage: node scripts/with-db.mjs <command…>");
  process.exit(1);
}

function fromEnvFile(key) {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function run(env) {
  // One command string (from package.json, not user input), run through the shell so `next` resolves on Windows too.
  return spawn(cmd.join(" "), { stdio: "inherit", shell: true, env: { ...process.env, ...env } });
}

/** The host in a postgres:// URL (no password), and whether it's this machine. Same rules as src/lib/env-check.ts. */
function dbHost(url) {
  try {
    return new URL(url).hostname || "localhost";
  } catch {
    return null;
  }
}
const isLocalHost = (host) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(String(host).toLowerCase());

const configured = local ? undefined : process.env.DATABASE_URL || fromEnvFile("DATABASE_URL");
if (configured) {
  const host = dbHost(configured);
  if (!isLocalHost(host)) console.warn(`\n  ⚠  Using the LIVE database (${host ?? "remote host"}): ${cmd.join(" ")}\n`);
  // Passed on explicitly: Next reads .env.local itself, but plain scripts (db:migrate) don't.
  run({ DATABASE_URL: configured }).on("exit", (code) => process.exit(code ?? 0));
} else if (process.env.VERCEL) {
  // A Vercel build or function must never fall back to a throwaway database.
  console.error("DATABASE_URL isn't set on Vercel. Add it in Project Settings → Environment Variables (see README, Going live).");
  process.exit(1);
} else {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  // LOCAL_PG_DIR / LOCAL_PG_PORT let the browser tests run their own database beside the dev one.
  const databaseDir = join(process.cwd(), process.env.LOCAL_PG_DIR ?? join(".data", "postgres"));
  const port = Number(process.env.LOCAL_PG_PORT ?? 5433);
  // Local-only credentials: the server listens on 127.0.0.1 and is never exposed.
  // UTF-8 always (Windows would otherwise pick its own code page, which can't store Nepali or arrows).
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "easypick-local",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });
  const bin = await import(`@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`);
  /**
   * Windows can leave workers of a killed server running (e.g. after the browser tests), holding the
   * port and shared memory. End only our own postgres.exe workers whose parent server is gone.
   * (ExecutablePath is often empty for these; the command line has the binary's path with forward slashes.)
   */
  const endOrphans = async () => {
    if (process.platform !== "win32") return false;
    const exe = bin.postgres.split(String.fromCharCode(92)).join("/").replace(/'/g, "''");
    const script = `Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | Where-Object { $_.CommandLine -like '*${exe}*forkchild*' -and -not (Get-Process -Id $_.ParentProcessId -ErrorAction SilentlyContinue) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
    execFileSync("powershell", ["-NoProfile", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 1000)); // let Windows free the port
    return true;
  };
  if (!existsSync(join(databaseDir, "PG_VERSION"))) {
    try {
      await pg.initialise();
    } catch (e) {
      if (!(await endOrphans())) throw e;
      await pg.initialise();
    }
  }
  try {
    await pg.start();
  } catch (e) {
    // Left running by a run that was killed: stop it cleanly (or end its orphaned workers), start again.
    if (existsSync(join(databaseDir, "postmaster.pid"))) execFileSync(bin.pg_ctl, ["stop", "-D", databaseDir, "-m", "fast"], { stdio: "ignore" });
    else if (!(await endOrphans())) throw e;
    await pg.start();
  }
  // The site's data lives in its own "easypick" database, created as UTF-8 even in an older data folder.
  const admin = pg.getPgClient();
  await admin.connect();
  const { rowCount } = await admin.query("select 1 from pg_database where datname = 'easypick'");
  if (!rowCount) await admin.query("create database easypick encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'");
  await admin.end();
  const url = `postgres://postgres:easypick-local@127.0.0.1:${port}/easypick`;
  console.log(`▲ Local database (PostgreSQL): 127.0.0.1:${port}  ·  data in ${databaseDir}`);

  // This local database is always migrated on start, even under `next build` / `next start`
  // (production mode, where auto-migrate is otherwise off). DB_AUTO_MIGRATE=false still wins.
  const child = run({ DATABASE_URL: url, DB_AUTO_MIGRATE: process.env.DB_AUTO_MIGRATE || fromEnvFile("DB_AUTO_MIGRATE") || "true" });
  let stopping = false;
  const stop = async (code = 0) => {
    if (stopping) return;
    stopping = true;
    try {
      await pg.stop(); // clean shutdown
    } finally {
      process.exit(code);
    }
  };
  child.on("exit", (code) => stop(code ?? 0));
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => stop(0));
}
