---
name: anchor-registry
description: DEPRECATED (M2). The manual PERSONAL_INFO_ELEMENT_REGISTRY this agent maintained has been replaced by the auto-discovery scanner (checkoutScanner.js). Do not use for new work. Element/registry concerns are now handled by the scanner at capture/render time, with the auto-maintained snapshot (CHECKOUT_ELEMENT_REGISTRY) enforced by Test 11 across all steps. Use the heatmap-qa agent instead.
---

# DEPRECATED — superseded by the auto-discovery scanner (M2)

This agent governed the M1 manual sync between `PERSONAL_INFO_ELEMENT_REGISTRY` and the
`data-heatmap-id` attributes in `CheckoutFlow.jsx`. That manual workflow no longer exists.

**What replaced it (M2):**
- **`lib/prototype/checkoutScanner.js`** performs live DOM discovery and is the source of
  truth for trackable elements. `data-heatmap-id` remains only as the manual override
  escape hatch for custom elements the scanner cannot infer.
- **`lib/prototype/checkoutHeatmapRegistry.js`** is now `CHECKOUT_ELEMENT_REGISTRY`: an
  auto-maintained snapshot of the tagged anchors per step (`steps` field), not a
  hand-edited list. It preserves the `addedAt`/`removedAt` lifecycle for M6/M8.
- **Test 11** enforces registry↔DOM parity automatically across all three steps
  (`personal-info`, `delivery`, `pay`).

**Use instead:** the **`heatmap-qa`** agent for capture-to-render review, and **`test-impact`**
to find which tests a change affects. Do not invoke this agent for new work; it is retained
only as a historical record of the M1 registry workflow.
