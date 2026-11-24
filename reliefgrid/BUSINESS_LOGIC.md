# ReliefGrid — Business Logic & Data Integrity

## Roles

1. **System Admin** — manage organizations, users/permissions, all activities, platform config, all incidents, analytics.
2. **Emergency Coordinator** — monitor/verify incidents, assign priority, review requests, allocate resources, coordinate teams.
3. **Relief Organization** — manage own resources, register resources, manage requests, track distribution, inventory history.
4. **Volunteer** — view assigned tasks/locations, update status, submit field reports/photos, report completion.
5. **Shelter Manager** — manage shelter info, capacity, occupancy, facilities, occupancy reports.

## Business Rules

The rules below are enforced by the server where noted. External delivery integrations and other remaining work are listed under Implementation Gaps.

### Resource Allocation
1. Allocations require a verified or already allocated request, a positive integer quantity, and a resource belonging to the assigned organization.
2. The allocation quantity cannot exceed the remaining request quantity or available stock. Inventory decrement, request update, allocation creation, and history writes run in one transaction.
3. Failed allocations do not modify inventory (transaction rollback).
4. Cancelling an assigned or in-transit allocation restores stock atomically and records a stock adjustment; delivered/cancelled allocations cannot be reopened.
5. Requests become completed after all allocations are terminal and at least one was delivered; when all allocations are cancelled, the request returns to verified.

### Shelter Capacity
1. New occupancy must never exceed `totalCapacity`, including when capacity is reduced (400 if exceeded). Concurrent updates to capacity or occupancy are rejected with 409 when their starting values have changed.
2. `availableCapacity = totalCapacity - currentOccupancy`, computed on read.
3. Occupancy changes write a `ShelterOccupancyLog` (previous → new) and an `ActivityLog`.

### Emergency Prioritization
1. Incidents and requests are sorted by `priorityScore` descending.
2. Incident scores consider severity, affected population, coordinator-assessed location risk (0–5), and elapsed time. Request scores consider urgency, affected people, the related incident's location risk, and elapsed time. Aging is capped so it cannot overwhelm severity or urgency.
3. Scores are recalculated by the server for list ranking; client-supplied scores are rejected. Equal scores are ordered oldest-first.
4. Priority and location-risk changes are recorded in `IncidentHistory` / `ActivityLog`.

### Volunteer Management
1. Volunteers can only update tasks where `volunteerId === user.id`.
2. Volunteers cannot change task assignments and may only move task status forward; completed tasks are read-only.
3. Field reports and activity history are retained. Up to three field photographs (800 KB each) can be uploaded; volunteers may add but not remove existing photos.

### Organization Security
1. Organization-facing incident, request, resource, allocation, team, and task queries are filtered by the authenticated organization where applicable; ownership is checked server-side.
2. System Admins see all organizations.
3. Relief Organization accounts must be linked to an organization. Registration creates the organization and account in one transaction; previously unlinked accounts must complete authenticated organization setup before organization-scoped analytics and records are available.
4. Emergency Coordinators manage authorized emergency operations.
5. Relief Organization shelter lists, details, and shelter analytics are scoped to shelters managed by users in their organization; Shelter Managers only access their assigned shelters.

### Data Integrity
- Allocation, shelter occupancy updates, and inventory adjustments use Prisma transactions.
- Resource edits cannot lower total stock below currently available stock plus active allocations, protecting cancellation returns.
- `IncidentHistory`, `ResourceStockHistory`, `ShelterOccupancyLog`, and `ActivityLog` record changes; task and allocation detail pages expose their activity history.
- `duplicateFlag` on requests detects duplicate requests for the same incident+type.
- `qrVerificationCode` on allocations is unique for QR-based distribution verification.

## Sample Data Minimums (via `prisma/seed.ts`)
- 5 Organizations
- 50 Incidents
- 100 Emergency Requests
- 20 Shelters
- 100 Volunteers
- 500 Resources

Development seed accounts use password `ReliefGrid@2026` by default. Production seeding requires `SEED_PASSWORD`; do not use the development password in production.

`prisma/seed-organization-demo.mts` adds a separate 50-incident, 100-request, 20-shelter, 100-volunteer, 500-resource dataset, plus teams, tasks, and allocations, to one explicitly selected organization. Run it with `--dry-run` first and `--apply` only after verifying the target database and organization. It is additive and blocks repeat or partial runs; generated synthetic user accounts receive random, undisclosed password hashes and are profile records, not demo logins.

## Remaining Implementation Gaps

- Incident photographs and volunteer field photographs are stored as bounded image data URLs in PostgreSQL. A dedicated object-storage provider is not configured.
- Incident and request CSV exports are available; PDF exports and email/SMS delivery are not implemented.
- Notifications are stored in-app and the unread count refreshes periodically; push-based delivery is not implemented.
- Allocation verification codes are generated and displayed, but a QR image/scanning workflow is not implemented.
- Organization isolation and inventory/history enforcement still need an independent security audit before operational use.
- Dashboard and incident/request lists refresh periodically; other screens refresh when opened or manually refreshed.
- Response-time analytics measure elapsed minutes from incident report to its first recorded VERIFIED, IN_PROGRESS, or RESOLVED transition; incidents without a recorded transition are excluded.
- The seed script creates sample data only when explicitly run; a new deployment starts empty.
