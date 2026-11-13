# Care360 design standards

Standing user requirement, recorded 3 November 2026: all new features must preserve the application's existing design language, including colours, fonts, spacing, components and interactions. This applies to subsequent sprints and phases.

## Source of truth

Styles load in this order in `angular.json`: bundled fonts, `styles.css`, `enterprise-theme.css`, `administration.css`, `workspace-design.css`, `dashboard-design.css`, `kpi-design.css`, `app/shared/styles/compact-workspace.css`. Read the applicable shared styles before introducing feature CSS. The enterprise theme overrides base tokens; use the final token, not a copied colour value.

- **Typography:** inherited Inter/system sans stack; use `ac-eyebrow`, `ac-page-title` and the shared section hierarchy. Do not import new fonts or override the body font per module. Monospace is reserved for technical payload/code previews.
- **Brand:** existing blue primary and purple secondary, through `--ac-primary`, `--ac-primary-hover`, `--ac-primary-fg`, `--ac-secondary` and their light variants. Do not introduce a new module palette.
- **Surfaces/text:** `--ac-bg`, `--ac-surface*`, `--ac-text*`, `--ac-muted*`, `--ac-border*`. These have light/dark values; avoid literal white/black backgrounds and feature-specific colour overrides.
- **Clinical status:** use semantic success/warning/error tokens and `ac-badge` variants. Include readable text so colour is never the sole status signal. Preserve API state codes in requests.
- **Controls:** `ac-btn` with primary/secondary/ghost variants; `ac-input` for text controls; shared `AcDropdownComponent` for single-choice selections, following surrounding modules. Primary buttons identify principal actions, secondary buttons identify supporting actions. Preserve disabled, hover and focus behaviour.
- **Layout:** `ac-workspace`, `ac-workspace-head`, `header-actions`, existing panels and `ac-table`. Use established 8/12/16/20/24px spacing, radius tokens and shared shadows. Feature styles should handle layout rather than redefine shared buttons, typography or colours.
- **Compact density:** use the shared compact workspace stylesheet for page headings, desktop filter controls, tables and pagination. Keep mobile action targets at least 44px. Pages with summary KPIs import `AC_KPI_VISIBILITY`, place one `ac-kpi-toggle` beside page actions and mark summary strips with `acKpiRegion`. Visibility is remembered per route without query parameters. Clinical warnings, allergy/safety information and workflow forms must remain outside collapsible regions. Pages without summary KPIs do not need a toggle.
- **Feedback:** semantic token colours for errors/success; `role=alert` for failures and `role=status` for confirmations. Loading/empty/error states must have visible text.
- **Responsive/accessibility:** no page-level horizontal overflow; contain wide tables in labelled, keyboard-focusable scroll regions. Forms collapse on small viewports, actions wrap, labels remain readable and mobile action buttons follow the shared 44px treatment. Reuse established form-control sizes. Respect shared focus and reduced-motion rules. Dropdown buttons need accessible labels; decorative icons need `aria-hidden=true`.
- **Maintainability:** no repeated inline style blocks or importing another feature's private stylesheet. Shared layout belongs under `src/app/shared/styles`; shared presentation helpers under `src/app/shared/ui`.

## Completion checks

1. Compare the feature with an established module such as OPD, Laboratory or Quality/KPI.
2. Check new/changed CSS for hard-coded colours, independent font families, global token redefinitions, duplicate control styling and inline style attributes.
3. Run typecheck, relevant behavioural regression tests and Angular builds for changed templates.
4. Inspect actual component rendering with synthetic data in light/dark and desktop/mobile layouts, including populated/empty/error states where applicable. Check dropdowns, focus, long identifiers and scroll containment.
5. Record which checks were executed and any limitations. A static/token audit or synthetic preview is not hospital UAT or a claim that the entire legacy application was visually audited.

Current alignment evidence is in `docs/PHASE-01-02-DESIGN-REVIEW.md`.

Phase 3 component and responsive/theme evidence is in `docs/PHASE-03-DESIGN-REVIEW.md`.
