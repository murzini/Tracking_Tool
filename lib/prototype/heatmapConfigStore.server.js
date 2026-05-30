import { getSql, SCHEMA } from "./db";

// M6 Part 2: Runtime config store. A single-row heatmap_config table per schema.
// GET returns the active config or defaults; POST upserts; DELETE removes (→ defaults).
// The defaults match today's behavior exactly so the dashboard is purely additive
// until an admin saves a change.

// Process-level write-through cache so the ingest endpoint (called on every event
// batch) doesn't hammer the DB on every request. Invalidated on save/delete so
// test correctness is preserved: a saveConfig call is always followed by a fresh read.
let _cache = null;

export function getDefaultHeatmapConfig() {
  return {
    steps: {
      "personal-info": true,
      "delivery": true,
      "pay": true,
    },
    eventTypes: {
      "click": true,
      "tap": true,
      "mouse-move": true,
      "scroll": true,
      "field-focus": true,
      "field-blur": true,
      "field-change": true,
      "validation-error": true,
      "element-visible": true,
      "element-hidden": true,
    },
    elementTypes: {
      "text": true,
      "toggle": true,
      "display": true,
      "error": true,
      "date": true,
      "tel": true,
      "dropdown": true,
      "button": true,
      "radio": true,
      "checkbox": true,
      "cta": true,
      "icon": true,
      "nav": true,
      "area": true,
      "tooltip": true,
      "tooltip-content": true,
      "accordion": true,
    },
    samplingRate: 1,
    captureWindow: { from: null, to: null },
    inactivityMs: 30000,
  };
}

export async function getHeatmapConfig() {
  if (_cache) return _cache;
  try {
    const sql = getSql();
    const rows = await sql.query(
      `SELECT config FROM "${SCHEMA}".heatmap_config WHERE id = 1`
    );
    const config = rows.length === 0
      ? getDefaultHeatmapConfig()
      : { ...getDefaultHeatmapConfig(), ...(rows[0].config ?? {}) };
    _cache = config;
    return config;
  } catch {
    return getDefaultHeatmapConfig();
  }
}

// Always reads from DB — never from the process-level cache.
// Used by the HTTP GET route so the endpoint always reflects persisted state,
// eliminating any race between _cache and concurrent saveHeatmapConfig calls.
export async function getHeatmapConfigFresh() {
  try {
    const sql = getSql();
    const rows = await sql.query(
      `SELECT config FROM "${SCHEMA}".heatmap_config WHERE id = 1`
    );
    return rows.length === 0
      ? getDefaultHeatmapConfig()
      : { ...getDefaultHeatmapConfig(), ...(rows[0].config ?? {}) };
  } catch {
    return getDefaultHeatmapConfig();
  }
}

export async function saveHeatmapConfig(config) {
  _cache = null;
  const sql = getSql();
  await sql.query(
    `INSERT INTO "${SCHEMA}".heatmap_config (id, config, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET config = $1::jsonb, updated_at = NOW()`,
    [JSON.stringify(config)]
  );
  // Null cache so the next GET always re-reads the persisted row from DB.
  // Optimistic set was causing cross-test contamination (Test 54 failure in
  // full suite) — a fresh DB read is the safe path for all callers.
  _cache = null;
  return config;
}

export async function deleteHeatmapConfig() {
  _cache = null;
  const sql = getSql();
  await sql.query(`DELETE FROM "${SCHEMA}".heatmap_config WHERE id = 1`);
}
