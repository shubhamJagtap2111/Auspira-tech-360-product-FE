# Responsive browser checks

Run the app locally on port 4205 (`npm start -- --host 127.0.0.1 --port 4205`).
Install Playwright in the development environment (`npm install --no-save playwright`) or provide it through `NODE_PATH`, then run `node tests/responsive-browser.cjs`.
The runner uses installed Chrome by default; override `PLAYWRIGHT_CHANNEL` if needed.

The test intercepts API requests and uses synthetic data. It does not log in to or change production data. Reports and pharmacy dashboard use populated fixtures; other screens cover their initial/empty layouts, not every data-dependent state.

Defaults cover widths 360, 768, 1024, 1280, 1366 and 1920. Override `RESPONSIVE_WIDTHS`, `RESPONSIVE_ROUTES` (comma-separated), or `RESPONSIVE_BASE_URL` as needed. Results and screenshots go to `artifacts/responsive/`.

Checks distinguish accessible horizontal table/tab scrolling from clipped page actions. A deployment smoke test should also cover real records, long names, permissions, open drawers, and dispensing/hospital-save workflows.
