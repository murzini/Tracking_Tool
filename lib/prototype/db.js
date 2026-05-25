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
