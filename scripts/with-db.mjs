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

const configured = local ? undefined : process.env.DATABASE_URL || fromEnvFile("DATABASE_URL");
if (configured) {
  run({}).on("exit", (code) => process.exit(code ?? 0));
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
  if (!existsSync(join(databaseDir, "PG_VERSION"))) await pg.initialise();
  try {
    await pg.start();
  } catch (e) {
    // Left running by a run that was killed (e.g. the browser tests on Windows): stop it cleanly, start again.
    const bin = await import(`@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`);
    if (existsSync(join(databaseDir, "postmaster.pid"))) execFileSync(bin.pg_ctl, ["stop", "-D", databaseDir, "-m", "fast"], { stdio: "ignore" });
    else if (process.platform === "win32") {
      // Windows can leave a worker of a killed server holding the port. End only our own
      // postgres.exe processes whose parent server is gone.
      // (ExecutablePath is often empty for these; the command line has the binary's path with forward slashes.)
      const exe = bin.postgres.split(String.fromCharCode(92)).join("/").replace(/'/g, "''");
      const script = `Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | Where-Object { $_.CommandLine -like '*${exe}*forkchild*' -and -not (Get-Process -Id $_.ParentProcessId -ErrorAction SilentlyContinue) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
      execFileSync("powershell", ["-NoProfile", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { stdio: "ignore" });
      await new Promise((r) => setTimeout(r, 1000)); // let Windows free the port
    } else throw e;
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

  const child = run({ DATABASE_URL: url });
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
