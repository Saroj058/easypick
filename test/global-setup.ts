import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import EmbeddedPostgres from "embedded-postgres";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** A fresh PostgreSQL for this test run, deleted afterwards. The app migrates and seeds it on first use. */
export default async function setup(project: TestProject) {
  const dir = mkdtempSync(join(tmpdir(), "easypick-test-"));
  const port = 5500 + Math.floor(Math.random() * 400);
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "test", port, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {} });
  await pg.initialise();
  await pg.start();
  project.provide("databaseUrl", `postgres://postgres:test@127.0.0.1:${port}/postgres`);
  return async () => {
    await pg.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
