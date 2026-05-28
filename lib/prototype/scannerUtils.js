// Pure string utilities used by checkoutScanner.js for anchor ID generation
// and element selection. Extracted so the rules can be tested without DOM.

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function safeAttrSelector(id) {
  return `[data-heatmap-id="${String(id).replace(/"/g, '\\"')}"]`;
}
