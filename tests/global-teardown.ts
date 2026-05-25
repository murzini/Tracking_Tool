import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

// M4 Part 5: wipe the test schema once after the full suite finishes so test data
// never persists between runs (it shares the Neon free-tier budget; per-test data
// is already cleared before each test). Guarded so it can ONLY ever touch the
// dedicated test schema — never `public` (production).
function loadEnvLocal() {
  try {
    const content = readFileSync(".env.local", "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // no .env.local — fall through; DATABASE_URL may be set another way
  }
}

export default async function globalTeardown() {
  const schema = process.env.HEATMAP_DB_SCHEMA;
  // Safety: only ever wipe the isolated test schema.
  if (schema !== "heatmap_test") {
    console.log(`  [teardown] skipped — HEATMAP_DB_SCHEMA is "${schema ?? "(unset)"}", not heatmap_test`);
    return;
  }

  loadEnvLocal();
  if (!process.env.DATABASE_URL) {
    console.log("  [teardown] skipped — DATABASE_URL not set");
    return;
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    // events cascade-delete from sessions via the FK, so truncating sessions
    // clears both tables.
    await sql.query(`TRUNCATE TABLE "${schema}".sessions CASCADE`);
    console.log(`  [teardown] wiped "${schema}" schema (sessions + events)`);
  } catch (err) {
    console.log(`  [teardown] wipe failed: ${(err as Error).message}`);
  }
}
