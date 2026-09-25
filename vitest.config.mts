import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests (no network) and database tests (a throwaway PostgreSQL started by test/global-setup.ts).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next's guard against importing server code in the browser; meaningless in tests.
      "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Database tests share one database; run files one after another.
    fileParallelism: false,
  },
});
