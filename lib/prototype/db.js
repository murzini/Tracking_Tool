import { neon } from '@neondatabase/serverless';

const SCHEMA = process.env.HEATMAP_DB_SCHEMA || 'public';
if (!/^[a-z_][a-z0-9_]*$/.test(SCHEMA)) {
  throw new Error(`Invalid HEATMAP_DB_SCHEMA: "${SCHEMA}"`);
}

let _sql = null;

export function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set. Add it to .env.local');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export { SCHEMA };

// Maps the `source` enum from API/viewer params to a concrete schema name.
// Only `real` (or absent), `sim`, and `demo` are valid — a raw schema name never
// travels from the client into SQL (closes the schema-injection surface).
// `demo` holds a frozen copy of real sessions used for the throwaway demo,
// kept separate from `sim` so the two data sets never overlap.
export function resolveHeatmapSchema(source) {
  if (!source || source === 'real') return SCHEMA;
  if (source === 'sim') return SCHEMA === 'public' ? 'heatmap_sim' : `${SCHEMA}_sim`;
  if (source === 'demo') return SCHEMA === 'public' ? 'heatmap_demo' : `${SCHEMA}_demo`;
  throw new Error(`Invalid heatmap source: "${source}"`);
}
