import { inject, vi } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";

// Next request-only helpers: run nothing after the response, and there's no page cache to clear.
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
vi.mock("next/cache", () => ({ revalidateTag: () => {}, revalidatePath: () => {}, updateTag: () => {}, unstable_cache: <T>(fn: T) => fn }));
