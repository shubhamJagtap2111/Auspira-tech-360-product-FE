# Phase 6 design consistency and verification

8 November 2026. Scope: `/operation-theatre` and the new surgical-record/handoff sections in the inpatient chart. Existing Phase 5 and unrelated compact-workspace changes were preserved.

## Source and automated checks

- Read the workspace/frontend instructions, `DESIGN-STANDARDS.md`, shared workspace styles and neighbouring clinical workspaces.
- Reused inherited Inter, Care360 blue/purple and semantic tokens, `AcDropdownComponent`, shared `ac-input`/`ac-btn`, workspace headers, panels, tables and feedback. Local CSS is limited to layout, fieldsets, wrapping and mobile action targets. No independent palette or font system was added.
- Wide tables have labelled, keyboard-focusable scroll containers and conditional `has-records`; long identifiers wrap. Mobile actions have a 44px minimum target. Clinical forms, safety/quality indicators and readiness checks are not collapsible KPI regions. Operational metrics are presented as a table, not a new KPI strip.
- Signed records and identification labels use text nodes and the existing label utility. Printing inherits the application font; clinical text is not inserted as HTML.
- Context changes clear pending forms, scans, equipment, previews and retry state. Pending commands freeze payloads and prevent refresh from unlocking the form. A successful booking selects the returned case and opens readiness. Pricing requires a current source-bound preview.
- 174 frontend behaviour tests passed, including 12 surgical tests. Optimized Angular build passed. The existing qrcode/dijkstrajs CommonJS warning remains.
- The temporary synthetic preview compiled the actual component with mock providers. Its entry and tsconfig were removed after review attempts; its local server was stopped. These preview providers are not part of the product entry point.

## Browser/visual acceptance remains open

The in-app preview browser timed out navigating to the local preview and then on CDP `Page.getFrameTree`. A native Chrome fallback was attempted through the computer-use skill; capture failed with `FrameArrived timed out: timed out waiting on channel` and `window capture timed out: timed out waiting on channel`. Recovery failed. The confirmed owned native New Tab was closed and the original localhost tab retained.

No completed screenshots, viewport matrix, measured font loading, dropdown inspection or browser-driven clinical submission are claimed. Source/token checks and compilation do not replace those checks.

Before visual acceptance, inspect calendar, readiness, timeline, devices, supplies, recovery, billing and configuration in light/dark at desktop/mobile sizes. Include populated/empty/error states, clinical/nurse/billing permissions, independent count witness selection, missing/artifact/gap display, long lot/serial identifiers, keyboard focus, dropdown expansion, signed-summary/wristband printing and stale-price handling. Review the linked inpatient chart and medication entry point too.

## Clinical/equipment acceptance remains separate

Synthetic observations and financial journeys do not certify monitors, anaesthesia machines, recovery criteria, medication workflows or billing policy. Hospital owners must approve these with real staffing, equipment and downtime procedures before clinical rollout.

The detailed implementation and operating boundaries are recorded in [the workspace implementation record](../../output/Care360-Phase-06-Implementation-and-Acceptance.md).
