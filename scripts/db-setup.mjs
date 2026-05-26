/**
 * M3 Part 1 — Create (or recreate) the Neon schema.
 * Run once before starting M3 development:  node scripts/db-setup.mjs
 * Pass --fresh to drop existing tables first (required when discarding old data).
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

// Load .env.local so DATABASE_URL is available without a separate dotenv install.
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

const FRESH = process.argv.includes('--fresh');
const SCHEMAS = ['public', 'heatmap_test'];
const sql = neon(DATABASE_URL);

async function run(query, label) {
  await sql.query(query);
  if (label) console.log(`  ✓ ${label}`);
}

async function setupSchema(schema) {
  console.log(`\n── Schema: ${schema} ──`);

  if (schema !== 'public') {
    await run(`CREATE SCHEMA IF NOT EXISTS "${schema}"`, `schema "${schema}" ready`);
  }

  if (FRESH) {
    await run(`DROP TABLE IF EXISTS "${schema}".events CASCADE`, 'events dropped');
    await run(`DROP TABLE IF EXISTS "${schema}".sessions CASCADE`, 'sessions dropped');
  }

  await run(`
    CREATE TABLE IF NOT EXISTS "${schema}".sessions (
      id                  TEXT        PRIMARY KEY,
      version             INTEGER     NOT NULL DEFAULT 1,
      step                TEXT        NOT NULL,
      sku                 TEXT,
      view                TEXT        NOT NULL,
      viewport_width      INTEGER,
      viewport_height     INTEGER,
      started_at          TIMESTAMPTZ NOT NULL,
      last_interaction_at TIMESTAMPTZ,
      finalized_at        TIMESTAMPTZ,
      coordinate_scope    TEXT,
      inactivity_ms       INTEGER,
      duration_ms         INTEGER,
      click_count         INTEGER     NOT NULL DEFAULT 0,
      interaction_count   INTEGER     NOT NULL DEFAULT 0,
      outcome             TEXT,
      exit_reason         TEXT,
      sampling_rate       NUMERIC,
      step_active_ms      INTEGER,
      step_idle_ms        INTEGER,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, 'sessions table ready');

  // Idempotent column adds for tables created by an earlier milestone.
  await run(
    `ALTER TABLE "${schema}".sessions ADD COLUMN IF NOT EXISTS exit_reason TEXT`,
    'sessions.exit_reason ready'
  );
  await run(
    `ALTER TABLE "${schema}".sessions ADD COLUMN IF NOT EXISTS visitor_id TEXT`,
    'sessions.visitor_id ready'
  );

  await run(`
    CREATE TABLE IF NOT EXISTS "${schema}".events (
      id          TEXT        PRIMARY KEY,
      session_id  TEXT        NOT NULL REFERENCES "${schema}".sessions(id) ON DELETE CASCADE,
      type        TEXT        NOT NULL,
      timestamp   TIMESTAMPTZ NOT NULL,
      detail      JSONB       NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, 'events table ready');

  // sessions indexes
  for (const [cols, suffix] of [
    ['step',              'step'],
    ['view',              'view'],
    ['started_at DESC',   'started_at'],
    ['step, view',        'step_view'],
    ['created_at DESC',   'created_at'],
  ]) {
    await run(
      `CREATE INDEX IF NOT EXISTS idx_sessions_${suffix} ON "${schema}".sessions(${cols})`,
      `idx_sessions_${suffix}`
    );
  }
  await run(
    `CREATE INDEX IF NOT EXISTS idx_sessions_outcome ON "${schema}".sessions(outcome) WHERE outcome IS NOT NULL`,
    'idx_sessions_outcome'
  );

  // events indexes
  for (const [cols, suffix] of [
    ['session_id',          'session_id'],
    ['type',                'type'],
    ['timestamp DESC',      'timestamp'],
    ['session_id, type',    'session_type'],
  ]) {
    await run(
      `CREATE INDEX IF NOT EXISTS idx_events_${suffix} ON "${schema}".events(${cols})`,
      `idx_events_${suffix}`
    );
  }
}

try {
  for (const schema of SCHEMAS) {
    await setupSchema(schema);
  }
  console.log('\n✓ Done. Tables and indexes ready in: ' + SCHEMAS.join(', '));
} catch (err) {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
}
