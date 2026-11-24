# ReliefGrid — Business Logic & Data Integrity

## Roles

1. **System Admin** — manage organizations, users/permissions, all activities, platform config, all incidents, analytics.
2. **Emergency Coordinator** — monitor/verify incidents, assign priority, review requests, allocate resources, coordinate teams.
3. **Relief Organization** — manage own resources, register resources, manage requests, track distribution, inventory history.
4. **Volunteer** — view assigned tasks/locations, update status, submit field reports/photos, report completion.
5. **Shelter Manager** — manage shelter info, capacity, occupancy, facilities, occupancy reports.

## Business Rules

The rules below are the intended behavior. Some remain incomplete; see Implementation Gaps.

### Resource Allocation
1. Allocations require a verified or already allocated request, a positive integer quantity, and a resource belonging to the assigned organization.
2. Available stock is checked and decremented atomically within a transaction; concurrent allocations cannot exceed the available quantity.
3. Failed allocations do not modify inventory (transaction rollback).
4. Every allocation creates a `ResourceStockHistory` record (type `ALLOCATED`) and an `ActivityLog`.
5. Completed distribution records are preserved; setting allocation status to `DELIVERED` marks the linked request `COMPLETED`.

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
2. Volunteers cannot change task team assignments (403).
3. Task fields and activity logs are stored, but report revisions are not retained as immutable history.

### Organization Security
1. Organization-facing incident, request, resource, and analytics queries are filtered by the authenticated organization where applicable; incident detail access is checked server-side.
2. System Admins see all organizations.
3. Emergency Coordinators manage authorized emergency operations.

### Data Integrity
- Allocation, shelter updates, and inventory adjustments use Prisma transactions. Other mutation paths still require review.
- `IncidentHistory`, `ResourceStockHistory`, `ShelterOccupancyLog`, and `ActivityLog` record some changes, but audit coverage is incomplete.
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

## Implementation Gaps

- Several create/detail links lead to pages that have not been implemented.
- Incident and request CSV exports are available; PDF exports and push-based real-time notifications are not implemented. Dashboard and incident/request lists refresh every 15 seconds while open.
- Response-time analytics measure elapsed minutes from incident report to its first recorded VERIFIED, IN_PROGRESS, or RESOLVED transition; incidents without a recorded transition are excluded.
- Organization isolation and inventory/history enforcement still need a full server-side audit before operational use.
- The seed script creates sample data only when explicitly run; a new deployment starts empty.
