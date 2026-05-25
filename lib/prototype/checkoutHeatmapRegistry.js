/**
 * Element registry snapshot for the checkout heatmap.
 *
 * M2: this file is an AUTO-MAINTAINED SNAPSHOT, not a hand-edited list. Live DOM
 * discovery via `checkoutScanner.js` is the source of truth; the snapshot records
 * the anchors discovered for each step so the `addedAt`/`removedAt` lifecycle
 * needed for timeframe filtering (M6) and the engagement report (M8) is preserved.
 *
 * Each entry mirrors the scanner anchor shape, plus a `steps` field:
 * - id:        stable anchor id in the format "type:label-slug" (also the value
 *              authored into the element's `data-heatmap-id` attribute).
 * - type:      element category (text, date, tel, dropdown, display, toggle,
 *              radio, checkbox, accordion, tooltip, tooltip-content, area, icon,
 *              nav, cta, …).
 * - label:     visible label the visitor sees.
 * - selector:  CSS selector that locates the element via its data-heatmap-id.
 * - steps:     which checkout steps the anchor renders on. Shared chrome (header,
 *              step pills, order summary, chatbot) lists all three; step-specific
 *              controls list only their step.
 * - addedAt:   ISO date the anchor first appeared.
 * - removedAt: ISO date it was removed, or null if still present.
 *
 * Do not hand-edit anchors away: mark `removedAt` instead of deleting, so history
 * is retained. New anchors are appended by the scan-maintenance path.
 *
 * Scope note: only TAGGED anchors (elements carrying a `data-heatmap-id`) are
 * recorded here. Untagged elements the scanner auto-discovers structurally (plain
 * inputs, the tooltip close button, validation error messages) are resolved live
 * at capture/render time and are intentionally not part of this snapshot.
 *
 * This snapshot reflects all three checkout steps: personal-info, delivery, pay.
 */

export const CHECKOUT_STEPS = ["personal-info", "delivery", "pay"];

export const CHECKOUT_ELEMENT_REGISTRY = [
  // ─── Shared chrome (rendered on every step) ──────────────────────────────────
  { id: "nav:header",                      type: "nav",             label: "Header",                      selector: '[data-heatmap-id="nav:header"]',                      steps: ["personal-info", "delivery", "pay"], addedAt: "2026-05-15", removedAt: null },
  { id: "nav:step-personal-information",   type: "nav",             label: "Personal Information",        selector: '[data-heatmap-id="nav:step-personal-information"]',   steps: ["personal-info", "delivery", "pay"], addedAt: "2026-05-15", removedAt: null },
  { id: "nav:step-choose-delivery",        type: "nav",             label: "Choose Delivery",             selector: '[data-heatmap-id="nav:step-choose-delivery"]',        steps: ["personal-info", "delivery", "pay"], addedAt: "2026-05-15", removedAt: null },
  { id: "nav:step-pay-finish",             type: "nav",             label: "Pay & Finish",                selector: '[data-heatmap-id="nav:step-pay-finish"]',             steps: ["personal-info", "delivery", "pay"], addedAt: "2026-05-15", removedAt: null },
  { id: "toggle:order-summary",            type: "toggle",          label: "Order summary",               selector: '[data-heatmap-id="toggle:order-summary"]',            steps: ["personal-info", "delivery", "pay"], addedAt: "2026-05-15", removedAt: null },
  { id: "area:order-summary",              type: "area",            label: "Order summary",               selector: '[data-heatmap-id="area:order-summary"]',              steps: ["personal-info", "delivery", "pay"], addedAt: "2026-05-20", removedAt: null },
  { id: "icon:chatbot",                    type: "icon",            label: "Chatbot",                     selector: '[data-heatmap-id="icon:chatbot"]',                    steps: ["personal-info", "delivery", "pay"], addedAt: "2026-05-15", removedAt: null },

  // ─── Personal Information step ───────────────────────────────────────────────
  { id: "toggle:private",                  type: "toggle",          label: "Private",                     selector: '[data-heatmap-id="toggle:private"]',                  steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "toggle:company",                  type: "toggle",          label: "Company",                     selector: '[data-heatmap-id="toggle:company"]',                  steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "text:name",                       type: "text",            label: "Name",                        selector: '[data-heatmap-id="text:name"]',                       steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "date:birthdate",                  type: "date",            label: "Birthdate",                   selector: '[data-heatmap-id="date:birthdate"]',                  steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "tooltip:birthdate-help",          type: "tooltip",         label: "Birthdate help",              selector: '[data-heatmap-id="tooltip:birthdate-help"]',          steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "tooltip-content:birthdate-help",  type: "tooltip-content", label: "Birthdate help tooltip",      selector: '[data-heatmap-id="tooltip-content:birthdate-help"]',  steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "dropdown:phone-code",             type: "dropdown",        label: "Phone code",                  selector: '[data-heatmap-id="dropdown:phone-code"]',             steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "tel:phone-number",                type: "tel",             label: "Phone number",                selector: '[data-heatmap-id="tel:phone-number"]',                steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "dropdown:street",                 type: "dropdown",        label: "Street",                      selector: '[data-heatmap-id="dropdown:street"]',                 steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "text:house-number",               type: "text",            label: "House number",                selector: '[data-heatmap-id="text:house-number"]',               steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "text:zip",                        type: "text",            label: "ZIP",                         selector: '[data-heatmap-id="text:zip"]',                        steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "display:city",                    type: "display",         label: "City",                        selector: '[data-heatmap-id="display:city"]',                    steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "display:country",                 type: "display",         label: "Country",                     selector: '[data-heatmap-id="display:country"]',                 steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "radio:color-black",               type: "radio",           label: "Black",                       selector: '[data-heatmap-id="radio:color-black"]',               steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "radio:color-navy",                type: "radio",           label: "Navy",                        selector: '[data-heatmap-id="radio:color-navy"]',                steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "radio:color-sand",                type: "radio",           label: "Sand",                        selector: '[data-heatmap-id="radio:color-sand"]',                steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "radio:color-forest",              type: "radio",           label: "Forest",                      selector: '[data-heatmap-id="radio:color-forest"]',              steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "checkbox:waterproof-cover",       type: "checkbox",        label: "Waterproof cover",            selector: '[data-heatmap-id="checkbox:waterproof-cover"]',       steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "accordion:price-calculated",      type: "accordion",       label: "How is my price calculated?", selector: '[data-heatmap-id="accordion:price-calculated"]',      steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "accordion:handover-work",         type: "accordion",       label: "How does the handover work?", selector: '[data-heatmap-id="accordion:handover-work"]',         steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "accordion:main-benefits",         type: "accordion",       label: "What are the main benefits?", selector: '[data-heatmap-id="accordion:main-benefits"]',         steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "area:reviews",                    type: "area",            label: "Personalised reviews",        selector: '[data-heatmap-id="area:reviews"]',                    steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },
  { id: "cta:choose-delivery",             type: "cta",             label: "Choose delivery",             selector: '[data-heatmap-id="cta:choose-delivery"]',             steps: ["personal-info"], addedAt: "2026-05-15", removedAt: null },

  // ─── Delivery step ───────────────────────────────────────────────────────────
  { id: "radio:delivery-novaposhta",       type: "radio",           label: "NovaPoshta",                  selector: '[data-heatmap-id="radio:delivery-novaposhta"]',       steps: ["delivery"], addedAt: "2026-05-20", removedAt: null },
  { id: "radio:delivery-courier-kyiv",     type: "radio",           label: "Our courier delivery",        selector: '[data-heatmap-id="radio:delivery-courier-kyiv"]',     steps: ["delivery"], addedAt: "2026-05-20", removedAt: null },
  { id: "radio:delivery-pickup",           type: "radio",           label: "Pick-up from our office in Kyiv", selector: '[data-heatmap-id="radio:delivery-pickup"]',       steps: ["delivery"], addedAt: "2026-05-20", removedAt: null },
  { id: "cta:pay-finish",                  type: "cta",             label: "Pay & Finish",                selector: '[data-heatmap-id="cta:pay-finish"]',                  steps: ["delivery"], addedAt: "2026-05-20", removedAt: null },

  // ─── Pay step ────────────────────────────────────────────────────────────────
  { id: "radio:pay-card",                  type: "radio",           label: "Credit Card",                 selector: '[data-heatmap-id="radio:pay-card"]',                  steps: ["pay"], addedAt: "2026-05-20", removedAt: null },
  { id: "radio:pay-gpay",                  type: "radio",           label: "Google Pay",                  selector: '[data-heatmap-id="radio:pay-gpay"]',                  steps: ["pay"], addedAt: "2026-05-20", removedAt: null },
  { id: "radio:pay-wire",                  type: "radio",           label: "Wire transfer",               selector: '[data-heatmap-id="radio:pay-wire"]',                  steps: ["pay"], addedAt: "2026-05-20", removedAt: null },
  { id: "cta:pay",                         type: "cta",             label: "Pay",                         selector: '[data-heatmap-id="cta:pay"]',                         steps: ["pay"], addedAt: "2026-05-20", removedAt: null },
];
