"use client";

const VISITOR_ID_KEY = "m1.heatmap.visitorId";
const LOGIN_DONE_KEY = "m1.login.done";

function generateUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function mintVisitorId() {
  const id = generateUuid();
  try {
    localStorage.setItem(VISITOR_ID_KEY, id);
    sessionStorage.setItem(LOGIN_DONE_KEY, "1");
  } catch {}
  return id;
}

export function getVisitorId() {
  try {
    return localStorage.getItem(VISITOR_ID_KEY) || null;
  } catch {
    return null;
  }
}

export function isLoginDone() {
  try {
    return sessionStorage.getItem(LOGIN_DONE_KEY) === "1";
  } catch {
    return false;
  }
}
