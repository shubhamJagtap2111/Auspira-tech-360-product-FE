# Operational notification inbox

The bell and `/notifications` now use `/api/v1/notification-inbox`. Emergency is hidden and its former route redirects to the dashboard. There are no demo alerts or fabricated unread counts.

## Connected events

| Module | Live triggers / reminders | Destination |
|---|---|---|
| Patients | Completed registration, reception permissions required | Patient record |
| Doctors | Leave, availability and schedule changes; registration renewal within 30 days | Appointments / Doctors |
| Appointments / OPD | Appointment changes; queue arrival directed to the linked doctor; overdue follow-up without a subsequent attended appointment | Appointment / OPD / patient history |
| IPD | Admission state and bed assignment changes | IPD workspace |
| Laboratory | Critical result, explicit-acknowledgement escalation after 15 minutes, released report, rejected sample, overdue STAT test using configured turnaround time | Critical / Collection / Orders / patient history |
| Pharmacy | Received/ready prescription when integration is enabled; medication order; partial dispensing; stock shortage; expiry within 30 days or already expired | Prescription queue / Stock & Batches |
| Billing | Requested refund/discount; overdue invoice; outstanding invoice linked to an initiated discharge | Billing workspace |
| Inventory | Reorder threshold crossing; draft purchase order review; maintenance due within 7 days | Items / Orders / Assets |
| Administration | Account state, branch and role/permission assignment changes | Profile / User Management |
| Quality | High/critical incident and warning/critical calculated indicator | Quality workspace |

Clinical queue delivery uses the existing doctor's email matched to an active, verified login, with branch and current permission checks. If no account is linked, a setup alert reaches authorised administrators rather than every doctor. Routine patient registration alerts go to registration users rather than all clinicians. Recipient routing uses active roles and direct permission grants; revoked permissions immediately hide the corresponding alerts.

## Delivery and security

Migration `045_operational_notification_inbox.sql` adds the durable inbox, indexes, recipient row security and workflow triggers. The workflow transaction and its notifications commit or roll back together. A unique recipient/event key prevents retry duplicates. The runtime role cannot forge messages or edit notification content. Read endpoints accept no recipient ID and recheck current branch access through the existing tenant connection factory. All-branch administrators see their own authorised organisation inbox; selecting a specific branch narrows it.

Read timestamps persist in PostgreSQL. Mark all read applies to the user's authorised selected workspace. A read action never updates clinical acknowledgement, dispensing, approval or task completion. Critical acknowledgement stays in Laboratory with its existing permissions and audit.

The bell polls every 60 seconds while the document is visible and refreshes on opening. Branch/account changes clear the previous scope immediately; stale responses are discarded. The centre supports module, priority, unread and pagination filters. Pending, empty and unavailable states are separate, with retry feedback. Links are restricted to application routes; target pages retain their normal authorization guards.

Time-based reminders run on authenticated refresh, using IST calendar dates. They do not run when nobody opens the application. Stock reminders share one shortage episode; recovery observed during refresh resets the episode. Equipment/expiry/follow-up/STAT/escalation reminders use stable condition keys. Historical alerts stay in the inbox even after the underlying condition is resolved; open the protected record for its current state.

## Scenarios without an underlying workflow

Emergency, scheduled report execution, external payment-provider failure callbacks, delivery promises and quality-submission deadlines are not connected to invented events. Their prerequisites must exist before corresponding notifications can be generated. This change supplies in-app notifications; it does not configure email, SMS, WhatsApp or OS push providers. Future offline/time-based delivery should run the same deduplicated reminder rules through a tenant-aware scheduled worker.

## Verification and rollout

- `node --test tests/*.test.cjs` verifies existing frontend workflow rules.
- `node tests/notification-inbox-browser.cjs` serves the built frontend with local API fixtures at four viewport widths and verifies bell count, popup, read persistence, critical separation, queue links, branch changes, pagination and failure feedback. No live API requests are allowed.
- `NotificationVerification.cs` extends the isolated branch integration suite with recipient/branch isolation, direct grants, revocation, persisted read actions, transactional rollback, deduplication and runtime forgery rejection.

Deploy the API with migration 045 before deploying the frontend. No existing events are backfilled into fake historical alerts. Workflow events start after migration; current time-based conditions are evaluated on the next authenticated refresh.

### Missing routes in an older deployment

On 8 October 2026 the Render API returned 404 for both the notification refresh and patient prescription document routes, and its published Swagger definition contained neither route. These routes are present in the current API source; changing clinical data or permissions cannot repair an absent deployed route. Deploy the current API and verify startup migrations, then deploy the matching frontend.

Run the API repository's read-only `scripts/Test-ApiReleaseRoutes.ps1 -ApiOrigin https://auspira-tech-360-product-api.onrender.com` after deployment. It fails if either required method/route is absent. The prescription frontend retains an exact-prescription saved-history fallback for older APIs; permission failures never use it. Notification 404 responses show an unavailable state and pause automatic retries for five minutes. The explicit Retry button checks immediately, so deployment recovery does not require signing out.
