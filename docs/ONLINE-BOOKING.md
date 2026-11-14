# Online appointment booking

Staff workspace: **Appointments → Online Booking & QR** (`/appointments/booking`). Doctor profiles and branch management provide contextual shortcuts. The public website uses `/book/{published-link-id}` without a staff login or clinical navigation.

## Behaviour

- Reception can schedule a new visitor using name/contact details without creating a patient record. Patient identity is verified on arrival, then linked to an existing record or registered once with an MRN and optional queue check-in. No-show/cancelled bookings remain appointments and do not consume a patient registration.
- Public booking uses approved profiles and real, explicitly published slots. It supports next available time search, temporary reservations, self/family attendee details, SMS contact verification, confirmation/calendar download, Print/Save PDF and verified cancellation/rescheduling. Contact verification does not establish patient identity.
- Staff can publish hospital/branch, department or doctor links, pause access, copy website button HTML, label poster placement, publish/close/reopen individual slots, review affected future appointments and view booking/message counts.
- A4/A5 wall posters and counter inserts include hospital name/address/phone, official Auspira artwork, vector QR, instructions and destination URL. SVG, high-resolution PNG and standalone QR exports are available. Native print provides PDF output. Do not distribute posters until the approved public domain and SMS delivery are configured and a physical sample has been scanned.
- A stale/lost response retains its command or reservation identity. Branch switches clear selections and cannot be overwritten by older responses. Unregistered bookings cannot enter the OPD clinical queue.

## Design

The workspace imports existing shared dropdowns, cards, buttons, tables and controls. Colours use the global enterprise theme tokens, including dark mode. Typography inherits bundled Inter. The public header uses the official transparent artwork at its natural aspect ratio; it does not use the staff shell. Small-screen forms collapse, actions wrap and long booking references wrap. Wide staff tables scroll inside labelled keyboard-focusable regions. KPI visibility preferences in other screens remain unchanged; this workspace has no summary KPI strip.

## Integration and rollout

See the API repository's `docs/ONLINE-BOOKING.md` for migrations 093–095, SMS relay contract, HTTPS URL and persistent encryption-key settings, schedule reconciliation, proxy routing and deployment/UAT steps. No SMS provider or public domain was supplied for this implementation; configuration remains disabled by default. Preview fixture addresses must never be used on production posters.

Current scope uses reviewed individual slots rather than generating recurring sessions. No online payment, automated waitlist, multilingual content, custom uploaded poster logo or cross-branch physical-doctor identity mapping is implied.

## Validation

The frontend regression suite passed **198/198** tests, including reservation/verification/confirmation acknowledgement loss, selection races, stale branch responses, appointment check-in and escaped vector posters. API coverage uses an isolated PostgreSQL database and real HTTP controllers with a synthetic SMS relay. Browser workflow checks used the built Angular application against that isolated API: public booking without patient creation, reception arrival, verified registration and queue entry, and poster preview. Final build, responsive/theme evidence and external activation limitations are recorded with the implementation result. Synthetic browser verification is separate from hospital UAT, real SMS handset delivery and physical print/scan acceptance.
