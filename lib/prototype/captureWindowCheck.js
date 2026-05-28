// The dashboard writes local-day strings ("YYYY-MM-DD"). A bare date string parses
// as midnight UTC, so `to` is extended to end-of-day (T23:59:59.999) and both
// bounds are parsed as local time — otherwise a `to` of "today" closes the window
// at the start of the day and discards the whole day's capture.
// Invalid date strings fail-open (window stays open).
export function isCaptureWindowOpen(captureWindow, now = Date.now()) {
  if (!captureWindow) return true;
  if (captureWindow.from) {
    const from = new Date(`${captureWindow.from}T00:00:00`).getTime();
    if (Number.isFinite(from) && now < from) return false;
  }
  if (captureWindow.to) {
    const to = new Date(`${captureWindow.to}T23:59:59.999`).getTime();
    if (Number.isFinite(to) && now > to) return false;
  }
  return true;
}
