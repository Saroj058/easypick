import { defineConfig } from "drizzle-kit";

// Migrations are generated from src/lib/db/schema.ts into /drizzle.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
});
