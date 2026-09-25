// Applies the migrations in /drizzle to DATABASE_URL (the live database).
// Usage: DATABASE_URL=postgresql://... npm run db:migrate
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first. (Locally, PGlite migrates itself when the site starts.)");
  process.exit(1);
}
const client = postgres(url, { max: 1, prepare: false });
await migrate(drizzle(client), { migrationsFolder: "drizzle" });
await client.end();
console.log("Database is up to date.");
