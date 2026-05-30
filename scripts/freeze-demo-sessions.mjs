/**
 * Freeze the real recorded sessions into a separate `heatmap_demo` schema
 * for the throwaway demo. Copies (does not move) every session + event from
 * `public` so the live Data/Heatmap sections stay free for the real-flow demo,
 * and the frozen set never overlaps the simulated sessions in `heatmap_sim`.
 *
 * Idempotent: re-running only inserts rows not already present.
 *   node scripts/freeze-demo-sessions.mjs
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

function loadEnvLocal() {
  try {
    const content = readFileSync('.env.local', 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

loadEnvLocal();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const SRC = 'public';
const DST = 'heatmap_demo';
const sql = neon(DATABASE_URL);

async function run(query, label) {
  await sql.query(query);
  if (label) console.log(`  ✓ ${label}`);
}

try {
  await run(`CREATE SCHEMA IF NOT EXISTS "${DST}"`, `schema "${DST}" ready`);
  await run(
    `CREATE TABLE IF NOT EXISTS "${DST}".sessions (LIKE "${SRC}".sessions INCLUDING DEFAULTS INCLUDING INDEXES)`,
    'sessions table ready'
  );
  await run(
    `CREATE TABLE IF NOT EXISTS "${DST}".events (LIKE "${SRC}".events INCLUDING DEFAULTS INCLUDING INDEXES)`,
    'events table ready'
  );

  await run(
    `INSERT INTO "${DST}".sessions SELECT * FROM "${SRC}".sessions ON CONFLICT (id) DO NOTHING`,
    'sessions copied'
  );
  await run(
    `INSERT INTO "${DST}".events SELECT * FROM "${SRC}".events ON CONFLICT (id) DO NOTHING`,
    'events copied'
  );

  const sc = await sql.query(`SELECT COUNT(*)::int AS count FROM "${DST}".sessions`);
  const ec = await sql.query(`SELECT COUNT(*)::int AS count FROM "${DST}".events`);
  console.log(`\n✓ heatmap_demo now holds ${sc[0].count} sessions, ${ec[0].count} events.`);
} catch (err) {
  console.error('\nFreeze failed:', err.message);
  process.exit(1);
}
