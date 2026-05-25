---
name: anchor-registry
description: DEPRECATED (M2). The manual element registry this agent maintained was replaced by the auto-discovery scanner (checkoutScanner.js). Do not use for new work. For element/registry concerns use heatmap-qa; to find which tests a change affects use test-impact.
---

# DEPRECATED (M2) — superseded by the auto-discovery scanner

This agent maintained the M1 manual sync between `PERSONAL_INFO_ELEMENT_REGISTRY` and the `data-heatmap-id` attributes in `CheckoutFlow.jsx`. That workflow no longer exists: `checkoutScanner.js` does live DOM discovery (the source of truth), `CHECKOUT_ELEMENT_REGISTRY` is an auto-maintained snapshot, and Test 11 enforces registry↔DOM parity across all three steps.

**Use instead:** `heatmap-qa` (capture→render review) and `test-impact` (which tests a change affects).

Retained only as a historical record — **safe to delete** if the catalogue is being cleaned up.
