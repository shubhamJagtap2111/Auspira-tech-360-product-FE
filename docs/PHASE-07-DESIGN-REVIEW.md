# Phase 7 design review — 13 November 2026

Scope: Stores, Allied Care and Kitchen use the existing shared Stores workspace, existing routes and role boundaries. Reference: DESIGN-STANDARDS.md.

## Source checks

The module inherits Care360 typography and blue/purple enterprise tokens. Forms use ac-input, shared AcDropdownComponent and ac-btn variants; tables use existing table/scroll patterns. Safety warnings and medication review remain outside collapsible KPI regions. Native policy checkboxes use the Angular checkbox accessor, theme accent and a 44px clickable label rather than the text-input accessor. Layout rules remain local; global theme tokens are unchanged for this feature.

Behavioral tests cover field serialization (including explicit false and negative temperatures), existing inspected-receipt contracts, optimistic versions, retry identities, medication safety overrides and discarding stale branch responses. The latest full frontend run passed 185 tests; the subsequent focused run passed 10 tests. These are source/behavior evidence, not visual acceptance. See the Phase 7 completion report for final build status.

## Actual rendering gate: open

The synthetic preview browser connection timed out. Native application discovery also timed out. No completed light/dark desktop/mobile visual inspection is claimed for this change. Repeat actual-component review with synthetic data when browser control is available, including Stores, Allied Care and Kitchen populated/empty/error/loading states, long tables, focus/keyboard/dropdowns, warning visibility and mobile containment. Record screenshots and defects before signing this gate.

## Separate acceptance

Physical device qualification, a second operator repeating onboarding and supervised hospital UAT remain separate gates. Neither template compilation nor a source-style test closes them. Follow API docs/phase-07/OPERATIONS-AND-ACCEPTANCE.md for responsibilities and workflows.


Final visual retry: the native helper listed Chrome after reset, but screenshot capture failed with "FrameArrived timed out" and, after refreshed selection, "window capture timed out". In-app browser creation timed out again. No screen acceptance is claimed. The temporary latest-build fixture rewrote only the copied API endpoint to local synthetic responses; repository production configuration was unchanged. The temporary fixture server was stopped.
