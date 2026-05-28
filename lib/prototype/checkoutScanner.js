/**
 * Checkout heatmap scanner (M2).
 *
 * Live DOM discovery is the source of truth for trackable elements. Given a root
 * node, the scanner walks the rendered DOM, matches elements against
 * `scannerConfig` (auto-discovered selectors + the `data-heatmap-id` escape
 * hatch + error messages), classifies each by type, derives a human label, and
 * emits a stable anchor id of the form `type:label-slug`.
 *
 * The same function runs in two contexts, against equivalent DOM:
 *  - capture (checkoutHeatmapClient.js): to resolve the anchor for a click.
 *  - render (heatmap page): to resolve a stored anchor id back to its element.
 *
 * Anchor id rules:
 *  - Tagged elements (carry `data-heatmap-id`): the attribute value *is* the id.
 *    These ids are authored directly in the `type:label` vocabulary, so they are
 *    stable regardless of scan order. The renderer can also resolve them via the
 *    attribute directly without re-scanning.
 *  - Untagged auto-discovered elements: the id is derived as `type:slug(label)`,
 *    with a positional suffix (`-2`, `-3`, …) appended in document order when two
 *    elements would otherwise collide.
 *
 * Type resolution precedence: explicit `data-heatmap-type` hint > the prefix of
 * an authored `data-heatmap-id` > structural inference from tag/role/input-type.
 */

import { scannerConfig, ERROR_SELECTOR } from "./scannerConfig";
import { slugify, safeAttrSelector } from "./scannerUtils";

const COMBINED_SELECTOR = [...scannerConfig.autoDiscovered, scannerConfig.manualOnly, ERROR_SELECTOR].join(",");

function inferStructuralType(el) {
  if (el.matches(ERROR_SELECTOR)) return "error";

  const tag = el.tagName.toLowerCase();
  const role = (el.getAttribute("role") || "").toLowerCase();
  const inputType = (el.getAttribute("type") || "").toLowerCase();

  if (tag === "input") {
    switch (inputType) {
      case "email":
        return "email";
      case "number":
        return "number";
      case "date":
        return "date";
      case "tel":
        return "tel";
      case "password":
        return "password";
      case "checkbox":
        return "checkbox";
      case "radio":
        return "radio";
      default:
        return "text";
    }
  }
  if (tag === "textarea") return "text";
  if (tag === "select") return el.hasAttribute("multiple") ? "multiselect" : "dropdown";
  if (tag === "a" && el.hasAttribute("href")) return "link";
  if (tag === "button" || role === "button") return "button";

  switch (role) {
    case "checkbox":
      return "checkbox";
    case "radio":
      return "radio";
    case "combobox":
      return "dropdown";
    case "listbox":
      return "multiselect";
    case "option":
      return "option";
    case "switch":
      return "toggle";
    default:
      return "area";
  }
}

function resolveType(el) {
  const hint = el.getAttribute("data-heatmap-type");
  if (hint && hint.trim()) return hint.trim();

  const tagged = el.getAttribute("data-heatmap-id");
  if (tagged && tagged.includes(":")) return tagged.split(":")[0];

  return inferStructuralType(el);
}

function deriveLabel(el) {
  const explicit = el.getAttribute("data-heatmap-label") || el.getAttribute("aria-label");
  if (explicit && explicit.trim()) return explicit.trim();

  const tag = el.tagName.toLowerCase();

  if (tag === "input" || tag === "select" || tag === "textarea") {
    const id = el.getAttribute("id");
    if (id) {
      const doc = el.ownerDocument || document;
      const labelFor = doc.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`);
      const labelText = labelFor && labelFor.textContent ? labelFor.textContent.trim() : "";
      if (labelText) return labelText;
    }
    const wrapper = el.closest("label");
    if (wrapper && wrapper.textContent && wrapper.textContent.trim()) return wrapper.textContent.trim();
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) return placeholder.trim();
    const name = el.getAttribute("name");
    if (name && name.trim()) return name.trim();
  }

  const text = el.textContent ? el.textContent.trim() : "";
  if (text && text.length <= 60) return text;

  return el.getAttribute("name") || el.getAttribute("id") || tag;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isIgnored(el) {
  return Boolean(el.closest && el.closest('[data-heatmap-ignore="true"]'));
}

/**
 * Scan the rendered DOM under `root` (default: whole document) and return an
 * ordered list of anchors: `{ id, type, label, selector, element }`.
 *
 * @param {ParentNode} [root]
 * @param {{ includeHidden?: boolean }} [options]
 */
export function scanCheckoutAnchors(root, { includeHidden = false } = {}) {
  const doc =
    (root && root.ownerDocument) ||
    (typeof document !== "undefined" ? document : null);
  if (!doc) return [];

  const scope = root || doc;
  const elements = Array.from(scope.querySelectorAll(COMBINED_SELECTOR));

  const anchors = [];
  const seen = new Set();
  const baseCounts = new Map();

  for (const el of elements) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (isIgnored(el)) continue;
    if (!includeHidden && !isVisible(el)) continue;

    const type = resolveType(el);
    const label = deriveLabel(el);
    const tagged = el.getAttribute("data-heatmap-id");

    let id;
    let selector = null;

    if (tagged) {
      id = tagged;
      selector = safeAttrSelector(tagged);
      // Reserve the authored id so a later derived id cannot collide with it.
      baseCounts.set(id, (baseCounts.get(id) || 0) + 1);
    } else {
      const base = `${type}:${slugify(label)}`;
      const next = (baseCounts.get(base) || 0) + 1;
      baseCounts.set(base, next);
      id = next === 1 ? base : `${base}-${next}`;
    }

    anchors.push({ id, type, label, selector, element: el });
  }

  return anchors;
}

/**
 * Build a Map of anchor id -> element from a scan, keeping the first occurrence
 * of each id. Convenience for the renderer's resolution path.
 *
 * @param {ParentNode} [root]
 */
export function buildAnchorIndex(root) {
  const index = new Map();
  for (const anchor of scanCheckoutAnchors(root)) {
    if (!index.has(anchor.id)) index.set(anchor.id, anchor.element);
  }
  return index;
}
