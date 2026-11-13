# Phase 5 design consistency review

7 November 2026. Scope: new Radiology and Emergency workspaces, their shared-order/laboratory context links, inpatient chart sections and imaging source selection in Phase 4 pricing.

## Source and build checks

- Read the workspace/frontend instructions, current design standards, global workspace styles and neighbouring Phase 4 workspace.
- New workspace inherits Inter and uses existing Care360 surface, text, border, primary and semantic tokens. No independent font import, literal colour palette, global token change or inline styling was introduced in the new template/layout stylesheet.
- Reuses `AcDropdownComponent`, `ac-input`, `ac-btn`, panels, workspace header, table and feedback conventions. Existing compact-workspace/global-theme changes belonging to other work were preserved.
- Tables have labelled keyboard-focusable scroll regions and conditional `has-records`. Local CSS handles wrapping, bounded image review, fieldsets and mobile targets; mobile action targets retain a 44px minimum.
- Clinical warnings, safety rules, consent/readiness and medication forms stay visible. No summary KPI strip was added, so this page needs no KPI visibility toggle.
- Context/request sequencing prevents stale branch, patient, safety and image responses replacing newer state. Pending clinical submissions disable the workflow fieldset; retry uses a stable command and frozen request payload.
- All 162 frontend behaviour tests passed, including Phase 5 context/retry/safety/prescription tests. Optimized Angular build passed. The existing `qrcode` dependency emits a `dijkstrajs` CommonJS optimization warning.
- Product source/bundle search found no temporary synthetic preview bootstrap or fixture identifiers. The owned preview server and temporary preview entry/tsconfig were removed after the attachment failure.

## Visual/browser checks — outstanding

An isolated preview compiled the actual Angular workspace with synthetic data; it was not a screenshot approximation. Browser attachment repeatedly failed, including a visible-tab attempt: `Timed out waiting for the Browser webview to attach for this browser-use page.` No screenshots or completed browser inspection are claimed.

Before visual acceptance, inspect both routes in light/dark themes at desktop and mobile widths, including populated, empty and error states. Check actual dropdown menus, keyboard focus, labels, safety sections, long IDs, prescription rows, print summaries and contained table scrolling. Extend this review to the touched laboratory, order, chart and pricing entry points. Source/build checks alone cannot close this requirement.

## Hospital acceptance — outstanding

Clinical users must validate the readiness/triage policies, medication and result ownership flows, reference-viewer intended use, printing and admission/discharge/transfer journeys. Actual MRI/PACS and second-modality qualification and hospital UAT are separate from synthetic software tests.

Detailed scope, configuration and remaining gates are in [the implementation record](../../output/Care360-Phase-05-Implementation-and-Acceptance.md) in the parent workspace's output directory.
