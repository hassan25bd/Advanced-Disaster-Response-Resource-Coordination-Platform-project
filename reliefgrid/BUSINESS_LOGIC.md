# ReliefGrid — Business Logic & Data Integrity

## Roles

1. **System Admin** — manage organizations, users/permissions, all activities, platform config, all incidents, analytics.
2. **Emergency Coordinator** — monitor/verify incidents, assign priority, review requests, allocate resources, coordinate teams.
3. **Relief Organization** — manage own resources, register resources, manage requests, track distribution, inventory history.
4. **Volunteer** — view assigned tasks/locations, update status, submit field reports/photos, report completion.
5. **Shelter Manager** — manage shelter info, capacity, occupancy, facilities, occupancy reports.

## Mandatory Business Rules (server-side enforced)

### Resource Allocation
1. The same resource cannot be allocated beyond its `availableQuantity`. Requests exceeding availability are rejected (400).
2. On successful allocation, `Resource.availableQuantity` is decremented atomically within a transaction.
3. Failed allocations do not modify inventory (transaction rollback).
4. Every allocation creates a `ResourceStockHistory` record (type `ALLOCATED`) and an `ActivityLog`.
5. Completed distribution records are preserved; setting allocation status to `DELIVERED` marks the linked request `COMPLETED`.

### Shelter Capacity
1. New occupancy must never exceed `totalCapacity` (400 if exceeded).
2. `availableCapacity = totalCapacity - currentOccupancy`, computed on read.
3. Occupancy changes write a `ShelterOccupancyLog` (previous → new) and an `ActivityLog`.

### Emergency Prioritization
1. Incidents and requests are sorted by `priorityScore` descending.
2. Priority score = severity weight × 10 + log10(affected) × factor + jitter.
3. Priority changes are recorded in `IncidentHistory` / `ActivityLog`.

### Volunteer Management
1. Volunteers can only update tasks where `volunteerId === user.id`.
2. Unauthorized users cannot modify volunteer assignments (403).
3. Completed tasks retain `fieldReport`, `fieldPhotos`, and history.

### Organization Security
1. Organizations manage only their own resources/records (`organizationId` filter).
2. System Admins see all organizations.
3. Emergency Coordinators manage authorized emergency operations.

### Data Integrity
- All mutations affecting inventory/capacity run in Prisma `$transaction` for atomicity.
- `IncidentHistory`, `ResourceStockHistory`, `ShelterOccupancyLog`, `ActivityLog`, `Notification` provide full audit trail.
- `duplicateFlag` on requests detects duplicate requests for the same incident+type.
- `qrVerificationCode` on allocations is unique for QR-based distribution verification.

## Sample Data Minimums (via `prisma/seed.ts`)
- 5 Organizations
- 50 Incidents
- 100 Emergency Requests
- 20 Shelters
- 100 Volunteers
- 500 Resources

All seed accounts share password `ReliefGrid@2026`.
