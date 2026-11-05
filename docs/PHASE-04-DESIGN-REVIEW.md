# Phase 4 design and behavior review

Date: 4 November 2026. Scope: revenue/payer and laboratory operations workspaces, their navigation, and the released-report link/section in the existing admission chart. Existing design standards remain the source of truth.

## Implementation

- Reuse Inter, existing blue/purple and semantic tokens, `ac-workspace`, shared buttons, inputs, `AcDropdownComponent`, tables and labelled keyboard-focusable scroll regions.
- Layout-only CSS under `features/phase-four`; shared clinical/integration workspace CSS remains shared. No new palette, font import, global token override, private feature stylesheet import or inline product layout styles.
- The mobile header initially inherited 42-pixel buttons. A local selector now follows the existing inpatient pattern and supplies 44-pixel action targets without changing global tokens.
- Populated tables use `has-records`; empty tables follow shared empty-state behavior. Wide financial/device/report tables scroll inside their labelled regions without page-level overflow.
- Claims use the selected server revision automatically. Staff do not edit concurrency counters. Stable command references survive a lost response; changed payloads receive a new reference.
- Branch/patient/admission changes clear contextual values and selected reports. Late responses cannot restore a previous context. Price input changes and confirmed posting clear the old estimate; posting always recalculates on the server and refreshes the authoritative ledger.
- Source charges remain owned by the original clinical/pharmacy workflow. Currency values use the existing INR presentation. Receipts reuse the established billing document renderer.
- Clinician views expose critical follow-up and released reports. The critical result includes patient identity, value, units, source flag and observation time; the operator-only device/configuration tabs are absent.

## Actual component review

Compiled the real Angular workspace component in a temporary standalone review entry with synthetic API/auth/branch providers. The review did not use live hospital credentials or records.

| Review | Cases | Result |
|---|---:|---|
| 19 workflow forms plus turnaround and compatibility/device views × light/dark × desktop/mobile | 84 | Passed |
| Empty/error states for revenue and laboratory × both themes and sizes | 16 | Passed |
| Clinician critical follow-up and opened report views × both themes and sizes | 8 | Passed |
| Claim selection/save without a revision input; price preview cleared after quantity change | 2 interaction journeys | Passed with synthetic responses |

Desktop: 1280 × 900. Mobile: 390 × 844. No page overflow, undersized mobile action targets or unexpected alerts in the main matrix. Final browser error log inspection returned no errors. Checked actual screenshots, readable statuses, populated/empty tables, shared dropdowns and report values.

Evidence: `D:/Auspira/output/phase4-design-review/viewport-matrix.json`, `states.json`, `clinician-states.json`, `interactions.json`, `summary.json` and associated PNGs. Representative preview: `phase4-preview.png`.

This is a review of the new workspaces and their shared presentation, not a fresh visual audit of every legacy screen. The existing chart addition reuses its shared button/dropdown/table presentation; earlier Phase 3 visual evidence remains in `PHASE-03-DESIGN-REVIEW.md`.

## Source/build checks and cleanup

- Frontend behavior suite: 146 passed.
- TypeScript typecheck passed.
- Optimized application build command: `npm run build -- --optimization=true --source-map=false`. The workspace has no named `production` configuration; use its base environment with explicit optimization.
- Known existing build warning: `qrcode` uses CommonJS `dijkstrajs`. No new build error was introduced.
- Removed temporary review entry/config before building the application. Scanned source and generated application bundles for exact synthetic review markers; none remained.
- Closed the temporary tab, reset the viewport override and stopped the temporary static server.

UI preview evidence is separate from backend database/API/gateway verification and from hospital UAT. Physical analyzer qualification, hospital financial approval and payer acceptance remain external pilot gates.
