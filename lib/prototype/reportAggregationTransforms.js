// Input: sessions = raw DB rows (snake_case), events = { id, session_id, type, timestamp, detail }

// --- Executive Summary ---

export function getTotalSessionCount(sessions) {
  return sessions.length;
}

export function getSessionsByExitReason(sessions) {
  const counts = { idle: 0, 'left-browser': 0, 'nav-click': 0, back: 0, none: 0 };
  for (const s of sessions) {
    const r = s.exit_reason ?? null;
    if (r === 'idle') counts.idle++;
    else if (r === 'left-browser') counts['left-browser']++;
    else if (r === 'nav-click') counts['nav-click']++;
    else if (r === 'back') counts.back++;
    else counts.none++;
  }
  return counts;
}

export function getReturnedAndCompletedCount(sessions) {
  const byVisitor = {};
  for (const s of sessions) {
    if (!s.visitor_id) continue;
    if (!byVisitor[s.visitor_id]) byVisitor[s.visitor_id] = { abandoned: false, completed: false };
    if (s.outcome === 'abandoned') byVisitor[s.visitor_id].abandoned = true;
    if (s.outcome === 'completed') byVisitor[s.visitor_id].completed = true;
  }
  return Object.values(byVisitor).filter(v => v.abandoned && v.completed).length;
}

export function getPerStepEntryExitTotals(sessions) {
  const byStep = {};
  for (const s of sessions) {
    if (!byStep[s.step]) byStep[s.step] = { step: s.step, total: 0, completed: 0, abandoned: 0 };
    byStep[s.step].total++;
    if (s.outcome === 'completed') byStep[s.step].completed++;
    if (s.outcome === 'abandoned') byStep[s.step].abandoned++;
  }
  return Object.values(byStep);
}

export function getLastActionsBeforeDropOff(sessions, events, n = 5) {
  const abandonedIds = new Set(sessions.filter(s => s.outcome === 'abandoned').map(s => s.id));
  const bySession = {};
  for (const e of events) {
    if (!abandonedIds.has(e.session_id)) continue;
    if (!bySession[e.session_id]) bySession[e.session_id] = [];
    bySession[e.session_id].push(e);
  }
  const counts = {};
  for (const evs of Object.values(bySession)) {
    const sorted = [...evs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    for (const e of sorted.slice(0, n)) counts[e.type] = (counts[e.type] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([eventType, count]) => ({ eventType, count }));
}

// --- Step Analysis: Engagement ---

export function getTimeToFirstInteraction(session, events) {
  const sessionEvents = events.filter(e => e.session_id === session.id);
  if (!sessionEvents.length) return null;
  const earliest = Math.min(...sessionEvents.map(e => new Date(e.timestamp).getTime()));
  return earliest - new Date(session.started_at).getTime();
}

export function getActiveIdleTimeSplit(sessions) {
  let totalActiveMs = 0, totalIdleMs = 0;
  for (const s of sessions) {
    totalActiveMs += s.step_active_ms || 0;
    totalIdleMs += s.step_idle_ms || 0;
  }
  return { totalActiveMs, totalIdleMs };
}

export function getElementVisibilityDurations(events) {
  const byAnchor = {};
  for (const e of events) {
    if (e.type !== 'element-hidden') continue;
    const anchorId = e.detail?.anchor?.id ?? e.detail?.anchor;
    if (!anchorId) continue;
    byAnchor[anchorId] = (byAnchor[anchorId] || 0) + (e.detail?.visibleMs || 0);
  }
  return Object.entries(byAnchor)
    .map(([anchor, totalVisibleMs]) => ({ anchor, totalVisibleMs }))
    .sort((a, b) => b.totalVisibleMs - a.totalVisibleMs);
}

export function getHesitationHotspots(events, gridSize = 50) {
  const moveBuckets = {}, clickBuckets = new Set();
  for (const e of events) {
    if (e.type === 'mouse-move') {
      const { x, y } = e.detail || {};
      if (x == null || y == null) continue;
      const key = `${Math.floor(x / gridSize)},${Math.floor(y / gridSize)}`;
      moveBuckets[key] = (moveBuckets[key] || 0) + 1;
    } else if (e.type === 'click' || e.type === 'tap') {
      const { x, y } = e.detail || {};
      if (x == null || y == null) continue;
      clickBuckets.add(`${Math.floor(x / gridSize)},${Math.floor(y / gridSize)}`);
    }
  }
  return Object.entries(moveBuckets)
    .filter(([k]) => !clickBuckets.has(k))
    .map(([key, dwellCount]) => {
      const [gx, gy] = key.split(',').map(Number);
      return { gridX: gx * gridSize, gridY: gy * gridSize, dwellCount };
    })
    .sort((a, b) => b.dwellCount - a.dwellCount);
}

// --- Step Analysis: Friction ---

export function getFieldAbandonmentRates(sessions, events) {
  const sessionIds = new Set(sessions.map(s => s.id));
  const focusByAnchor = {}, changeByAnchor = {};
  for (const e of events) {
    if (!sessionIds.has(e.session_id)) continue;
    const anchorId = e.detail?.anchor?.id ?? e.detail?.anchor;
    if (!anchorId) continue;
    if (e.type === 'field-focus') focusByAnchor[anchorId] = (focusByAnchor[anchorId] || 0) + 1;
    if (e.type === 'field-change') changeByAnchor[anchorId] = (changeByAnchor[anchorId] || 0) + 1;
  }
  return Object.keys(focusByAnchor).map(anchor => {
    const focusCount = focusByAnchor[anchor] || 0;
    const changeCount = changeByAnchor[anchor] || 0;
    return { anchor, focusCount, changeCount, abandonRate: focusCount > 0 ? (focusCount - changeCount) / focusCount : 0 };
  }).sort((a, b) => b.abandonRate - a.abandonRate);
}

export function getValidationErrorSequences(sessions, events, n = 5) {
  const abandonedIds = new Set(sessions.filter(s => s.outcome === 'abandoned').map(s => s.id));
  const bySession = {};
  for (const e of events) {
    if (e.type !== 'validation-error' || !abandonedIds.has(e.session_id)) continue;
    if (!bySession[e.session_id]) bySession[e.session_id] = [];
    bySession[e.session_id].push(e);
  }
  return Object.entries(bySession).map(([sessionId, evs]) => {
    const sorted = [...evs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return { sessionId, errors: sorted.slice(0, n).map(e => e.detail?.anchor).filter(Boolean) };
  });
}

const RAGE_CLICK_WINDOW_MS = 2000;
const RAGE_CLICK_MIN = 3;

export function getRageClickSessions(events) {
  const bySessionAnchor = {};
  for (const e of events) {
    if (e.type !== 'click' && e.type !== 'tap') continue;
    const anchorId = e.detail?.anchor?.id;
    if (!anchorId) continue;
    const key = `${e.session_id}::${anchorId}`;
    if (!bySessionAnchor[key]) bySessionAnchor[key] = { sessionId: e.session_id, anchor: anchorId, times: [] };
    bySessionAnchor[key].times.push(new Date(e.timestamp).getTime());
  }
  const results = [];
  for (const { sessionId, anchor, times } of Object.values(bySessionAnchor)) {
    if (times.length < RAGE_CLICK_MIN) continue;
    const sorted = [...times].sort((a, b) => a - b);
    for (let i = 0; i <= sorted.length - RAGE_CLICK_MIN; i++) {
      if (sorted[i + RAGE_CLICK_MIN - 1] - sorted[i] <= RAGE_CLICK_WINDOW_MS) {
        results.push({ anchor, sessionId });
        break;
      }
    }
  }
  return results;
}

const DEAD_CLICK_TYPES = new Set(['display', 'area', 'error', 'tooltip-content', 'nav']);

export function getDeadClicks(events) {
  const counts = {};
  for (const e of events) {
    if (e.type !== 'click' && e.type !== 'tap') continue;
    const anchorType = e.detail?.anchor?.type;
    const anchorId = e.detail?.anchor?.id;
    if (!anchorType || !anchorId || !DEAD_CLICK_TYPES.has(anchorType)) continue;
    counts[anchorId] = (counts[anchorId] || 0) + 1;
  }
  return Object.entries(counts).map(([anchor, count]) => ({ anchor, count })).sort((a, b) => b.count - a.count);
}

export function getDropOffTriggers(sessions, events) {
  const abandonedIds = new Set(sessions.filter(s => s.outcome === 'abandoned').map(s => s.id));
  const lastBySession = {};
  for (const e of events) {
    if (!abandonedIds.has(e.session_id)) continue;
    const cur = lastBySession[e.session_id];
    if (!cur || new Date(e.timestamp) > new Date(cur.timestamp)) lastBySession[e.session_id] = e;
  }
  const counts = {};
  for (const e of Object.values(lastBySession)) counts[e.type] = (counts[e.type] || 0) + 1;
  return Object.entries(counts).map(([eventType, count]) => ({ eventType, count })).sort((a, b) => b.count - a.count);
}

// --- Step Analysis: Patterns ---

export function getZeroClickDropOffCount(sessions, events) {
  const abandonedIds = sessions.filter(s => s.outcome === 'abandoned').map(s => s.id);
  const withClicks = new Set(events.filter(e => e.type === 'click' || e.type === 'tap').map(e => e.session_id));
  return abandonedIds.filter(id => !withClicks.has(id)).length;
}

export function getSessionResumeCount(sessions, events, gapThresholdMs = 10000) {
  const sessionIds = new Set(sessions.map(s => s.id));
  const bySession = {};
  for (const e of events) {
    if (!sessionIds.has(e.session_id)) continue;
    if (!bySession[e.session_id]) bySession[e.session_id] = [];
    bySession[e.session_id].push(new Date(e.timestamp).getTime());
  }
  let count = 0;
  for (const times of Object.values(bySession)) {
    if (times.length < 2) continue;
    const sorted = [...times].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] >= gapThresholdMs) { count++; break; }
    }
  }
  return count;
}

export function getReturningVisitorsStats(sessions) {
  const byVisitor = {};
  for (const s of sessions) {
    if (!s.visitor_id) continue;
    if (!byVisitor[s.visitor_id]) byVisitor[s.visitor_id] = [];
    byVisitor[s.visitor_id].push(s);
  }
  const returning = Object.values(byVisitor).filter(v => v.length > 1);
  const count = returning.length;
  const allSessions = returning.flat();
  const dropOffRate = allSessions.length > 0
    ? allSessions.filter(s => s.outcome === 'abandoned').length / allSessions.length
    : 0;
  return { count, dropOffRate };
}

export function getCompletorsVsDropOffComparison(sessions) {
  const completors = sessions.filter(s => s.outcome === 'completed');
  const dropOffs = sessions.filter(s => s.outcome === 'abandoned');
  function avg(arr, fn) { return arr.length ? arr.reduce((sum, s) => sum + (fn(s) || 0), 0) / arr.length : 0; }
  return {
    completors: {
      count: completors.length,
      avgDurationMs: avg(completors, s => s.duration_ms),
      avgActiveMs: avg(completors, s => s.step_active_ms),
      avgIdleMs: avg(completors, s => s.step_idle_ms),
    },
    dropOffs: {
      count: dropOffs.length,
      avgDurationMs: avg(dropOffs, s => s.duration_ms),
      avgActiveMs: avg(dropOffs, s => s.step_active_ms),
      avgIdleMs: avg(dropOffs, s => s.step_idle_ms),
    },
  };
}

export function getDesktopVsMobileComparison(sessions) {
  function stats(arr) {
    const completed = arr.filter(s => s.outcome === 'completed').length;
    const abandoned = arr.filter(s => s.outcome === 'abandoned').length;
    return { count: arr.length, completedCount: completed, abandonedCount: abandoned, abandonRate: arr.length > 0 ? abandoned / arr.length : 0 };
  }
  return {
    desktop: stats(sessions.filter(s => s.view === 'desktop_view')),
    mobile: stats(sessions.filter(s => s.view === 'mobile_view')),
  };
}
