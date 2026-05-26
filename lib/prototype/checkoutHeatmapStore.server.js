import {
  CHECKOUT_HEATMAP_OUTCOMES,
  finalizeCheckoutHeatmapSession,
  normalizeCheckoutHeatmapSession,
} from "./checkoutHeatmap";
import { getSql, SCHEMA } from "./db";

function rowToSession(row) {
  const eventsJson = Array.isArray(row.events_json)
    ? row.events_json
    : typeof row.events_json === "string"
    ? JSON.parse(row.events_json)
    : [];

  return normalizeCheckoutHeatmapSession({
    id: row.id,
    version: row.version,
    step: row.step,
    sku: row.sku,
    view: row.view,
    viewport: { width: row.viewport_width, height: row.viewport_height },
    startedAt: row.started_at,
    lastInteractionAt: row.last_interaction_at,
    finalizedAt: row.finalized_at,
    coordinateScope: row.coordinate_scope,
    inactivityMs: row.inactivity_ms,
    durationMs: row.duration_ms,
    clickCount: row.click_count,
    interactionCount: row.interaction_count,
    outcome: row.outcome,
    exitReason: row.exit_reason,
    stepActiveMs: row.step_active_ms,
    stepIdleMs: row.step_idle_ms,
    samplingRate: row.sampling_rate != null ? Number(row.sampling_rate) : 1,
    visitorId: row.visitor_id ?? null,
    events: eventsJson.map((e) => ({
      id: e.id,
      type: e.type,
      timestamp: typeof e.timestamp === "string" ? e.timestamp : new Date(e.timestamp).toISOString(),
      ...(e.detail || {}),
    })),
  });
}

function sessionSelectFrom(schema) {
  return `
    SELECT
      s.id, s.version, s.step, s.sku, s.view,
      s.viewport_width, s.viewport_height,
      s.started_at, s.last_interaction_at, s.finalized_at,
      s.coordinate_scope, s.inactivity_ms, s.duration_ms,
      s.click_count, s.interaction_count, s.outcome, s.exit_reason,
      s.step_active_ms, s.step_idle_ms, s.sampling_rate, s.visitor_id,
      COALESCE(
        json_agg(
          json_build_object(
            'id', e.id,
            'type', e.type,
            'timestamp', e.timestamp,
            'detail', e.detail
          ) ORDER BY e.timestamp
        ) FILTER (WHERE e.id IS NOT NULL),
        '[]'::json
      ) AS events_json
    FROM "${schema}".sessions s
    LEFT JOIN "${schema}".events e ON e.session_id = s.id`;
}

export async function readCheckoutHeatmapSessions() {
  try {
    const sql = getSql();
    const rows = await sql.query(
      `${sessionSelectFrom(SCHEMA)} GROUP BY s.id ORDER BY s.started_at DESC`
    );
    return rows.map(rowToSession);
  } catch {
    return [];
  }
}

export async function queryCheckoutHeatmapSessions({ step, view, from, to } = {}) {
  try {
    const sql = getSql();
    const conditions = [];
    const params = [];
    let idx = 1;

    if (step) { conditions.push(`s.step = $${idx++}`); params.push(step); }
    if (view) { conditions.push(`s.view = $${idx++}`); params.push(view); }
    if (from) { conditions.push(`s.started_at >= $${idx++}`); params.push(from); }
    if (to) { conditions.push(`s.started_at <= $${idx++}`); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await sql.query(
      `${sessionSelectFrom(SCHEMA)} ${where} GROUP BY s.id ORDER BY s.started_at DESC`,
      params
    );
    return rows.map(rowToSession);
  } catch {
    return [];
  }
}

export async function appendCheckoutHeatmapSession(session) {
  const sql = getSql();
  const normalized = normalizeCheckoutHeatmapSession(session);

  await sql.query(
    `INSERT INTO "${SCHEMA}".sessions (
      id, version, step, sku, view,
      viewport_width, viewport_height,
      started_at, last_interaction_at, finalized_at,
      coordinate_scope, inactivity_ms, duration_ms,
      click_count, interaction_count, outcome, exit_reason,
      step_active_ms, step_idle_ms, sampling_rate
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    ON CONFLICT (id) DO UPDATE SET
      finalized_at        = EXCLUDED.finalized_at,
      last_interaction_at = EXCLUDED.last_interaction_at,
      duration_ms         = EXCLUDED.duration_ms,
      click_count         = EXCLUDED.click_count,
      interaction_count   = EXCLUDED.interaction_count,
      outcome             = EXCLUDED.outcome,
      exit_reason         = EXCLUDED.exit_reason,
      step_active_ms      = EXCLUDED.step_active_ms,
      step_idle_ms        = EXCLUDED.step_idle_ms,
      sampling_rate       = EXCLUDED.sampling_rate`,
    [
      normalized.id,
      normalized.version,
      normalized.step,
      normalized.sku,
      normalized.view,
      normalized.viewport.width,
      normalized.viewport.height,
      normalized.startedAt,
      normalized.lastInteractionAt,
      normalized.finalizedAt,
      normalized.coordinateScope,
      normalized.inactivityMs,
      normalized.durationMs ?? null,
      normalized.clickCount ?? 0,
      normalized.interactionCount ?? 0,
      normalized.outcome ?? null,
      normalized.exitReason ?? null,
      normalized.stepActiveMs ?? null,
      normalized.stepIdleMs ?? null,
      normalized.samplingRate ?? 1,
    ]
  );

  for (const event of normalized.events) {
    const { id, type, timestamp, ...detail } = event;
    await sql.query(
      `INSERT INTO "${SCHEMA}".events (id, session_id, type, timestamp, detail)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [id, normalized.id, type, timestamp, JSON.stringify(detail)]
    );
  }

  return normalized;
}

// M4 Part 2: batched ingest. Accepts a session snapshot + a batch of events and
// writes them in a bounded number of round-trips per batch (session upsert + a
// single multi-row event INSERT) instead of one INSERT per event. Idempotent:
// re-delivered events conflict on id and are skipped. The session upsert
// COALESCE-protects finalized_at/outcome so an incremental (non-final) flush
// arriving before/after finalize never erases a finalized result.
export async function ingestCheckoutHeatmapBatch({ session, events } = {}) {
  const sql = getSql();
  const normalized = normalizeCheckoutHeatmapSession({
    ...(session || {}),
    events: events ?? session?.events ?? [],
  });

  // M4 Part 6: a committed-but-unfinalized session reads as `in-progress` rather
  // than a bare null. The finalize flush (advanced/completed/abandoned) carries
  // its own outcome; only the incremental/beacon commits (no outcome, not yet
  // finalized) are stamped here.
  const outcomeToWrite =
    normalized.finalizedAt == null && normalized.outcome == null
      ? CHECKOUT_HEATMAP_OUTCOMES.IN_PROGRESS
      : normalized.outcome;

  await sql.query(
    `INSERT INTO "${SCHEMA}".sessions (
      id, version, step, sku, view,
      viewport_width, viewport_height,
      started_at, last_interaction_at, finalized_at,
      coordinate_scope, inactivity_ms, duration_ms,
      click_count, interaction_count, outcome, exit_reason,
      step_active_ms, step_idle_ms, sampling_rate, visitor_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
    ON CONFLICT (id) DO UPDATE SET
      last_interaction_at = EXCLUDED.last_interaction_at,
      duration_ms         = COALESCE(EXCLUDED.duration_ms, "${SCHEMA}".sessions.duration_ms),
      click_count         = GREATEST(EXCLUDED.click_count, "${SCHEMA}".sessions.click_count),
      interaction_count   = GREATEST(EXCLUDED.interaction_count, "${SCHEMA}".sessions.interaction_count),
      -- M4 Part 6: a terminal outcome (advanced/completed/abandoned) wins so a
      -- late or out-of-order in-progress flush never reverts a resolved session.
      -- Otherwise take the incoming outcome, falling back to the current one.
      outcome             = CASE
                              WHEN "${SCHEMA}".sessions.outcome IN ('advanced','completed','abandoned')
                                THEN "${SCHEMA}".sessions.outcome
                              ELSE COALESCE(EXCLUDED.outcome, "${SCHEMA}".sessions.outcome)
                            END,
      exit_reason         = COALESCE(EXCLUDED.exit_reason, "${SCHEMA}".sessions.exit_reason),
      step_active_ms      = COALESCE(EXCLUDED.step_active_ms, "${SCHEMA}".sessions.step_active_ms),
      step_idle_ms        = COALESCE(EXCLUDED.step_idle_ms, "${SCHEMA}".sessions.step_idle_ms),
      finalized_at        = COALESCE(EXCLUDED.finalized_at, "${SCHEMA}".sessions.finalized_at),
      sampling_rate       = EXCLUDED.sampling_rate,
      -- M5: first non-null visitor_id wins (COALESCE so a late beacon never clears an already-set id).
      visitor_id          = COALESCE("${SCHEMA}".sessions.visitor_id, EXCLUDED.visitor_id)`,
    [
      normalized.id,
      normalized.version,
      normalized.step,
      normalized.sku,
      normalized.view,
      normalized.viewport.width,
      normalized.viewport.height,
      normalized.startedAt,
      normalized.lastInteractionAt,
      normalized.finalizedAt,
      normalized.coordinateScope,
      normalized.inactivityMs,
      normalized.durationMs ?? null,
      normalized.clickCount ?? 0,
      normalized.interactionCount ?? 0,
      outcomeToWrite ?? null,
      normalized.exitReason ?? null,
      normalized.stepActiveMs ?? null,
      normalized.stepIdleMs ?? null,
      normalized.samplingRate ?? 1,
      normalized.visitorId ?? null,
    ]
  );

  if (normalized.events.length) {
    const rows = [];
    const params = [];
    let p = 1;
    for (const event of normalized.events) {
      const { id, type, timestamp, ...detail } = event;
      rows.push(`($${p++},$${p++},$${p++},$${p++},$${p++}::jsonb)`);
      params.push(id, normalized.id, type, timestamp, JSON.stringify(detail));
    }
    await sql.query(
      `INSERT INTO "${SCHEMA}".events (id, session_id, type, timestamp, detail)
       VALUES ${rows.join(",")}
       ON CONFLICT (id) DO NOTHING`,
      params
    );
  }

  // Reflect what was actually persisted (the in-progress stamp included).
  return { ...normalized, outcome: outcomeToWrite ?? null };
}

export async function clearCheckoutHeatmapSessions() {
  const sql = getSql();
  await sql.query(`DELETE FROM "${SCHEMA}".sessions`);
}

export async function cleanupCheckoutHeatmapSessions(before) {
  const sql = getSql();
  const rows = await sql.query(
    `DELETE FROM "${SCHEMA}".sessions WHERE finalized_at IS NOT NULL AND finalized_at < $1 RETURNING id`,
    [before]
  );
  return rows.length;
}

// M4 Part 5 — lazy/derived finalize (no always-on runtime). A closed tab cannot
// run its own timer, so a session whose grace window (X) has elapsed with no
// completion is dropped off "on read": this sweep finds such sessions and marks
// them `abandoned`, deriving the drop-off time from the last interaction + X.
// Idempotent — once finalized (or once an outcome is set) a session is skipped.
// Sessions that completed/advanced already carry an outcome and finalized_at, so
// they are never touched. Called by the dedicated sweep endpoint (tests/manual).
export async function sweepCheckoutHeatmapSessions({ now = Date.now(), force = false } = {}) {
  const sql = getSql();
  // `force` skips the grace-window check (used by tests/manual checks to finalize
  // immediately); the normal path only finalizes sessions whose window X has
  // elapsed since the last interaction. Only bind $1 when the condition uses it.
  const params = [];
  let ageCondition = "";
  if (!force) {
    params.push(new Date(now).toISOString());
    ageCondition = `AND s.last_interaction_at < ($1::timestamptz - (COALESCE(s.inactivity_ms, 30000) || ' milliseconds')::interval)`;
  }
  const rows = await sql.query(
    `${sessionSelectFrom(SCHEMA)}
     WHERE s.finalized_at IS NULL
       AND (s.outcome IS NULL OR s.outcome = 'in-progress')
       ${ageCondition}
     GROUP BY s.id`,
    params
  );

  let finalized = 0;
  for (const row of rows) {
    const session = rowToSession(row);
    const lastMs = new Date(session.lastInteractionAt || session.startedAt).getTime();
    const finalizedSession = finalizeCheckoutHeatmapSession(session, {
      finalizedAt: lastMs + (session.inactivityMs ?? 30000),
      inactivityMs: session.inactivityMs,
      outcome: "abandoned",
    });
    await appendCheckoutHeatmapSession(finalizedSession);
    finalized += 1;
  }
  return finalized;
}
