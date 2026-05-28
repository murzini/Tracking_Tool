import { isCaptureWindowOpen } from "./captureWindowCheck.js";

// Fails open for unknown/unconfigured steps — only an explicit `false` gates.
export function isStepGated(config, step) {
  return config?.steps?.[step] === false;
}

export function isSamplingGated(config) {
  return typeof config?.samplingRate === "number" && config.samplingRate <= 0;
}

export function isCaptureWindowGated(config, now = Date.now()) {
  return !isCaptureWindowOpen(config?.captureWindow, now);
}

// Fails open for event types absent from config — only an explicit `false` strips.
export function filterEventsByType(config, events) {
  if (!config?.eventTypes || typeof config.eventTypes !== "object") return events;
  return events.filter((e) => config.eventTypes[e?.type] !== false);
}
