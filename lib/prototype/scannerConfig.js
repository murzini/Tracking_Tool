/**
 * Scanner configuration for the checkout heatmap (M2).
 *
 * This config replaces the hand-maintained element registry as the *definition*
 * of what is trackable. It has two sections only:
 *
 * - `autoDiscovered`: structural selectors the scanner walks against the rendered
 *   DOM of the active step. Any element matching one of these is tracked.
 * - `manualOnly`: the escape hatch. Any element carrying a `data-heatmap-id`
 *   attribute is tracked regardless of type — used for custom elements the
 *   structural scan does not recognise (nav regions, content areas, icons,
 *   read-only display fields, etc.).
 *
 * The config carries NO enable/disable state. In M2 every listed type is active.
 * Per-type enable/disable is deferred to the M6 admin dashboard and will live in
 * runtime config, not in this file.
 *
 * Semantic types that cannot be inferred from markup (e.g. `cta`, `toggle`,
 * `tooltip`, or date/tel controls built from a plain `<input>`/`<button>`) are
 * declared on the element with an explicit `data-heatmap-type` attribute; the
 * scanner trusts that hint over the structural guess. See `checkoutScanner.js`.
 */

export const scannerConfig = {
  autoDiscovered: [
    "input",
    "select",
    "button",
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="option"]',
    "a",
  ],
  manualOnly: "[data-heatmap-id]",
};

/**
 * Non-interactive validation/error messages are tracked because *where* errors
 * surface is itself a drop-off signal. They are detected structurally via the
 * `data-field-error` attribute rather than by tag/role, so they live outside the
 * `autoDiscovered` selector list but are still discovered automatically.
 */
export const ERROR_SELECTOR = "[data-field-error]";
