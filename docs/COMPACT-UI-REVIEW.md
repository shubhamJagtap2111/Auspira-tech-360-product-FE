# Compact enterprise workspace review

## Changes

- Shared workspace density reduces page-title size to 22px, workspace gaps to 12px, desktop action buttons to 36px, and desktop table-cell padding to 6px vertically. Rows can grow for wrapped content.
- Shared KPI cards are 72px tall rather than 88px. Existing Care360 blue/purple tokens, Inter typography, semantic statuses, focus treatments and theme surfaces remain the source of truth.
- A single **Show KPIs / Hide KPIs** button controls all designated summary strips on each page. The preference survives refreshes and is independent between pages. Route patterns are stored rather than patient/doctor identifiers; query parameters do not create separate preferences. The control also works when browser storage is blocked.
- Mobile actions retain 44px targets. Registry actions and search/filter controls wrap into fewer rows. Wide KPI strips and tables keep their existing contained scrolling.
- Clinical alerts, patient safety metrics, permissions, branch scope, workflow requests and clinical form values are outside the KPI visibility change.

The integration covers 32 component templates: the hospital dashboard, patient/doctor registries and profiles, appointments, OPD, IPD, laboratory, pharmacy, billing, inventory, reports, MIS, quality, branches, roles, account profile, support, the fallback module workspace and 12 platform administration templates. Pages without summary KPIs use the compact shared layout without an empty KPI toggle.

## Source and build checks

- Application TypeScript check passed.
- All 150 unit/regression tests passed, including four new preference tests for page independence, persistence, identifier-free keys, blocked storage and dynamic region cleanup.
- The final normal production build of the combined checkout passed. It reports the existing `dijkstrajs` CommonJS optimization warning. Earlier concurrent Phase 5 template errors no longer occur in this final build; that feature work was left untouched.
- A separate temporary Angular workspace compiled the current compact UI against the route configuration from the starting revision. This avoids both concurrent route changes and development-server reloads during browser checks. Its configuration and output are under `tmp/compact-validation/`; it does not replace application routes in the working tree.
- An additional compile entry explicitly importing the 12 unrouted platform components found pre-existing missing exports (`RegisterTenantRequest` and `TenantRegistrationResponse`) in `super-admin/tenant-management.models.ts`. Their model imports were not changed by this UI work. Those legacy components therefore have source-level integration, not a successful full template-compilation claim.

## Browser and visual checks

Chrome used intercepted API responses and synthetic identities only. No production records were accessed or changed.

- `tests/compact-ui-browser.cjs` passed 80 checks: 20 routed KPI pages at 390px and 1366px, in light and dark themes. It checks a single page toggle, Enter-key activation, expanded state, collapsed strip removal, refresh persistence, independent SPA page preferences, mobile target height, horizontal overflow and continued visibility of clinical alerts/safety summaries.
- The profile, branch, role and support runs include empty summary states; registries and the main workspaces use synthetic populated summaries. This does not cover every editor, role, API failure or clinical data combination.
- Patient Registry screenshots were inspected in desktop/mobile and light/dark layouts. Additional profile, administration and support screenshots are retained with the browser results.
- Results are in `artifacts/compact-ui/results-light.json` and `results-dark.json`, with the combined matrix in `results.json`; screenshots are in the same folder. Theme selection uses the real application header control after fixture data loads and after reloads, so screenshots reflect the selected theme.
- A separate layout pass completed 58/58 viewport checks across 29 routes at 390px and 1366px, including pages without KPI summaries. It used the existing responsive runner's layout checks with its separate mobile-navigation interaction prelude omitted. Results are in `artifacts/responsive/results-compact-layout.json`; this is layout evidence, not a new claim about navigation behavior.

The 12 platform administration components are not routed by the starting application route configuration. Their KPI integration is source-reviewed separately; the 80 browser checks cover the 20 routed pages, not those platform screens.

## Hospital UAT and deployment

Hospital UAT and deployment were not performed. Real-record workflows, all roles/permissions and the concurrently developed Phase 5 screens require their own integrated UAT. The successful combined build does not extend the isolated browser matrix to those new screens.
