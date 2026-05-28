export const MIN_SESSIONS_OPTIONS = [100, 200, 500, 1000];
export const DEFAULT_MIN_SESSIONS = 100;

export function isReportGateMet(sessionCount, minSessions) {
  if (typeof sessionCount !== "number" || typeof minSessions !== "number") return false;
  return sessionCount >= minSessions;
}

export function getGateNoteText(sessionCount, minSessions) {
  const count = typeof sessionCount === "number" ? sessionCount : 0;
  return `Report requires at least ${minSessions} sessions. Currently accumulated: ${count}.`;
}
