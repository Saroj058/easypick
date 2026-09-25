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
import { spawn } from "node:child_process";
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
  const databaseDir = join(process.cwd(), ".data", "postgres");
  const port = Number(process.env.LOCAL_PG_PORT ?? 5433);
  // Local-only credentials: the server listens on 127.0.0.1 and is never exposed.
  const pg = new EmbeddedPostgres({ databaseDir, user: "postgres", password: "easypick-local", port, persistent: true, onLog: () => {} });
  if (!existsSync(join(databaseDir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  const url = `postgres://postgres:easypick-local@127.0.0.1:${port}/postgres`;
  console.log(`▲ Local database (PostgreSQL): 127.0.0.1:${port}  ·  data in .data/postgres`);

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
