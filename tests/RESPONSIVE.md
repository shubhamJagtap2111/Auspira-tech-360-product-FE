# Responsive browser checks

Run the app locally on port 4205 (`npm start -- --host 127.0.0.1 --port 4205`).
Install Playwright in the development environment (`npm install --no-save playwright`) or provide it through `NODE_PATH`, then run `node tests/responsive-browser.cjs`.
The runner uses installed Chrome by default; override `PLAYWRIGHT_CHANNEL` if needed.

The test intercepts API requests and uses synthetic data. It does not log in to or change production data. The administration dashboard, reports, and pharmacy dashboard use populated fixtures; other screens cover their initial/empty layouts, not every data-dependent state. Fonts and icons are bundled locally.

Defaults cover widths 360, 768, 1024, 1280, 1366 and 1920. Override `RESPONSIVE_WIDTHS`, `RESPONSIVE_ROUTES` (comma-separated), or `RESPONSIVE_BASE_URL` as needed. Results and screenshots go to `artifacts/responsive/`.

The default route list covers 29 clinical, operational, administrative, profile, and support pages. Checks distinguish accessible horizontal table/tab scrolling from clipped page actions. The runner also checks mobile navigation focus, background isolation, Escape focus restoration, closing on route selection, and the dark theme toggle. Set `RESPONSIVE_SCREENSHOTS=1` to capture representative pages and `RESPONSIVE_DIALOGS=1` to check the medicine dialog.

A deployment smoke test should also cover real records, long names, permissions, open drawers, and dispensing/hospital-save workflows.

Set `RESPONSIVE_DROPDOWNS=1` to test every visible shared dropdown on the selected routes for outside mouse clicks/touch taps, Escape, and focus leaving the control. This also covers account/language/notification menus, patient country/date popups, and dropdowns inside patient, doctor, and appointment editors. Escape must close the popup while keeping its editor open. The populated OPD smoke test separately checks medicine suggestion dismissal and selection at six widths, including event handlers that stop propagation.
