# Auspira Care360 Frontend

All new UI must follow the [standing design standards](docs/DESIGN-STANDARDS.md). The [Phase 1–2 design review](docs/PHASE-01-02-DESIGN-REVIEW.md) records the current consistency audit and verification.

Phase 2 adds `/orders` (shared department worklists) and `/integrations` (standard reference device operations, mappings, quarantine, simulation review and delivery recovery). The doctor desk opens clinical orders with patient/encounter context in a separate tab to preserve the active consultation. See the [Sprints 4–6 runbook](../Auspira-tech-360-product-API/docs/phase-02/sprints-04-06.md) for migrations, permissions and simulation boundaries.

This Angular application is being migrated to the Hospital-only frontend defined in:

- [Hospital architecture](../Auspira-tech-360-product-API/docs/AUSPIRA-ECOSYSTEM-TARGET-ARCHITECTURE.md)
- [Implementation workflow](../Auspira-tech-360-product-API/docs/AUSPIRA-ARCHITECTURE-IMPLEMENTATION-WORKFLOW.md)

The current source still contains legacy tenant context and Auspira super-admin features. Those features will be moved to a separate internal Platform frontend through the phased workflow; new Hospital features must not add dependencies on them.

## Local development and verification

Use Node 24 and `npm ci` (the local baseline used Node 24.20.0). `npm start` uses the development configuration and `/api/v1` through the dev-server proxy to `http://127.0.0.1:5216`; local development no longer calls the deployed API. The normal deployment build retains its existing API origin.

```powershell
npm run typecheck
npm test
npm run build
npm run build -- --configuration development
```

`npm test` runs the existing Node regressions. No Angular test/lint builder is configured; the previous `ng test`/`ng lint` entries did not provide working checks. Type checking is separate and does not claim lint coverage. CI checks both builds using the committed lockfile.
# Phase 3 inpatient workspace

The `/inpatient-care` route uses `InpatientCare.View` and the existing theme/controls for nursing, specimen tracking, medication reconciliation/administration, analyzer reference review and chart/transfer/discharge workflows. See [design evidence](docs/PHASE-03-DESIGN-REVIEW.md) and the API repository's `docs/phase-03/sprints-07-09.md` pilot runbook. Real equipment qualification and hospital UAT remain separate from the synthetic software checks.
