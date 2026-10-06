# Auspira Care360 application design

The application uses the official Auspira website palette: blue `#2563eb`, purple `#7c3aed`, navy `#172554`, and restrained blue/purple surface tints. The official logo is bundled locally. Green, amber, orange, and red remain available for process and clinical status rather than decoration.

`src/enterprise-theme.css` defines the shared visual system after the base stylesheet. Component styles use the shared `--ac-*` variables for borders, backgrounds, text, and brand colors. Light and dark themes share the same hierarchy. Keep focus indicators visible and compact; avoid restoring wide focus shadows.

Page headings explain the task, actions sit beside the heading when space permits, and cards group related information. The dashboard puts operational metrics before secondary actions. Avoid adding technical implementation language to clinician-facing copy.

Navigation becomes a labeled drawer at widths up to 1024 px. It traps focus, isolates the background, closes on Escape or page selection, and restores focus to its trigger. At phone widths the header uses two rows. Forms stack as the available workspace narrows; tables retain local horizontal scrolling. Container queries account for the width remaining after desktop navigation.

New pages should use existing buttons, dropdowns, status badges, form controls, and page containers. Use `minmax(0, 1fr)` for flexible grid columns and `min-width: 0` on flexible children. Do not force a fixed page width or hide overflow to mask clipped controls. Keep dialogs within the viewport and provide meaningful accessible names for icon-only actions.

The synthetic responsive runner covers 29 routes and mobile navigation behavior. See `tests/RESPONSIVE.md` for commands and coverage limits. OPD has a separate populated workflow smoke test, and business logic regressions live in `tests/*.test.cjs`.
