# Phase 1–2 design consistency review

Reviewed: **3 November 2026**. Result: reviewed Phase 1 frontend configuration and aligned the two new Phase 2 screens with the existing Care360 design system. Phase 3 has not been started.

## Scope and findings

| Area | Finding and result |
|---|---|
| Phase 1 | Added development/build/verification configuration, not new UI screens. Confirmed the global stylesheet order, bundled fonts and theme files remain unchanged. Both product build configurations pass. |
| Phase 2: Clinical Orders | Replaced local button/input/table styling with shared classes, native selections with `AcDropdownComponent`, raw workflow labels with readable presentation labels, and status text with shared semantic badges. |
| Phase 2: Device Integrations | Applied the same controls, typography, feedback, tables and semantic badges. Removed inline styles and the dependency on the Orders feature's private stylesheet. |
| Shared layout | Moved common layout to `src/app/shared/styles/clinical-integration-workspace.css`. Brand colours, fonts, radii, surfaces and feedback use existing theme tokens. No global theme token values were changed. |
| Visual defects corrected | Removed the hard-coded error colour and independent 6px control radii; corrected the unsupported navigation icon; made the device-registration field fill the mobile panel; kept empty table messages visible on mobile without fragmented column headings. |
| Behaviour | Kept API values, requests, permissions, branch handling, order lifecycle and review actions unchanged. Presentation helpers format labels and choose existing badge classes only. |

## Design sources

The source of truth remains `src/styles.css`, `src/enterprise-theme.css`, `src/workspace-design.css`, the other existing global styles, bundled font assets and shared UI components. Existing OPD and Quality/KPI components were used as pattern references.

Verified inherited Inter typography, the existing blue/purple brand treatment, dark-mode surface/text tokens, shared section hierarchy, primary/secondary buttons, dropdowns, inputs, table formatting, semantic status badges and focus rules. Technical payload previews use monospace intentionally; ordinary UI text retains Inter.

## Executed verification

- **129 frontend tests passed**, including the existing order retry/branch-isolation UI tests and new design consistency guards.
- Typecheck passed.
- Final production build and development build passed after temporary preview source/config files were removed.
- `git diff --check` passed. Global styles and font files have no diff.
- Checked the actual Angular components in an isolated browser preview with synthetic data and mocked service providers; no live hospital/API credentials or patient data were used.
- Inspected both screens in **light and dark themes**, at desktop **1280px** and mobile **390px** widths. Observed Inter loaded successfully. Measured no page-level horizontal overflow: 1275px document width in the 1280px viewport, and 385px in the 390px viewport (scrollbar space accounts for the difference).
- Confirmed mobile primary action buttons are 44px high. Populated tables scroll within their approximately 325px mobile containers; the 660px table minimum does not push the page wider. Empty tables fit the same container without horizontal scrolling.
- Selected a patient through the shared dropdown and confirmed the visible selection updated. Reviewed empty and error feedback states. No browser console errors were observed in the inspected preview.
- Temporary preview entry/config files were removed from product source. Preview artifacts remain under `.maintenance`; the preview is not a production authentication configuration.

These are source/build checks and synthetic visual verification of the Phase 1–2 changes, not hospital UAT, real-device acceptance or a complete redesign/audit of every legacy screen. Backend logic was not changed for this design review.

## Screenshots and logs

| Screen | Desktop light | Desktop dark | Mobile light | Mobile dark |
|---|---|---|---|---|
| Clinical Orders | [Image](D:/Auspira/output/design-review/orders-light-desktop.jpg) | [Image](D:/Auspira/output/design-review/orders-dark-desktop.jpg) | [Image](D:/Auspira/output/design-review/orders-light-mobile.jpg) | [Image](D:/Auspira/output/design-review/orders-dark-mobile.jpg) |
| Device Integrations | [Image](D:/Auspira/output/design-review/integrations-light-desktop.jpg) | [Image](D:/Auspira/output/design-review/integrations-dark-desktop.jpg) | [Image](D:/Auspira/output/design-review/integrations-light-mobile.jpg) | [Image](D:/Auspira/output/design-review/integrations-dark-mobile.jpg) |

Additional evidence: [full Clinical Orders screen](D:/Auspira/output/design-review/orders-light-desktop-full.jpg), [mobile empty state](D:/Auspira/output/design-review/orders-empty-mobile.jpg). Build/test logs: `D:/Auspira/.maintenance/phase2/design-*.log`.

## Standing rule for future phases

The user requires this visual consistency for every new feature. It is recorded in both the workspace `D:/Auspira/AGENTS.md` and frontend `AGENTS.md`, with the detailed checklist in [DESIGN-STANDARDS.md](DESIGN-STANDARDS.md). The frontend test suite now guards the Phase 2 templates against hard-coded feature palettes, inline layout styles and loss of shared button/table/dropdown patterns.
