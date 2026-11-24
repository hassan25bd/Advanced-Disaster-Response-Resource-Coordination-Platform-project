# ReliefGrid — API Documentation

Base URL: `http://localhost:3000`
Auth: NextAuth.js JWT session cookie (`next-auth.session-token`). All `/api/*` routes require a valid session unless noted.

## Authentication

- `POST /api/auth/login` — NextAuth credentials sign-in (handled by NextAuth handler at `/api/auth/[...nextauth]`)
- `POST /api/auth/register` — register a VOLUNTEER or RELIEF_ORGANIZATION; organization registration requires `organizationName` and `registrationNo` and creates the linked organization atomically
- `GET /api/me` — current authenticated user
- `POST /api/auth/signout` — sign out

## Common Query Parameters

List endpoints support: `page` (default 1), `pageSize` (default 10, max 100), `search` where available. Incident search covers title, description, and location; request search covers request description/location and the related incident title/location.

Responses are shaped `{ data, total, page, pageSize }`.

## Endpoints

### Organizations
- `GET /api/organizations` — list (System Admin sees all; others see own)
- `POST /api/organizations` — create (System Admin)
- `POST /api/organizations/onboard` — create and link an organization for an authenticated RELIEF_ORGANIZATION account that has no organization yet
- `GET /api/organizations/[id]` — get (System Admin)
- `PUT /api/organizations/[id]` — update (System Admin)
- `DELETE /api/organizations/[id]` — delete (System Admin)

### Users
- `GET /api/users` — list (RBAC filtered by org/role)
- `GET /api/users/[id]` — get one
- `PATCH /api/users/[id]` — update (Admin/Coordinator scope)

### Incidents
- `GET /api/incidents` — list, ranked by calculated priority score (severity, affected population, coordinator-assessed location risk, and age); paginated and searchable
- `POST /api/incidents` — create; coordinators/admins may provide `locationRiskScore` from 0 (unassessed) to 5 (extreme)
- `GET /api/incidents/[id]` — detail with history, requests, tasks
- `PATCH /api/incidents/[id]` — update (tracked in IncidentHistory); only coordinators/admins may change status, severity, affected population, coordinator, or location risk. Priority scores are server-calculated.
- `DELETE /api/incidents/[id]` — delete (System Admin)

### Emergency Requests
- `GET /api/requests` — list, ranked by calculated priority score (urgency, affected people, related incident location risk, and age); paginated and searchable
- `POST /api/requests` — create (duplicate detection → REJECTED)
- `GET /api/requests/[id]` — detail
- `PATCH /api/requests/[id]` — update priority/status (audit logged)

### Resources
- `GET /api/resources` — list inventory
- `POST /api/resources` — register resource (RESTOCK history)
- `GET /api/resources/[id]` — detail with stock history
- `PATCH /api/resources/[id]` — update (org-scoped)
- `DELETE /api/resources/[id]` — delete

### Resource Allocations
- `GET /api/allocations` — list
- `POST /api/allocations` — allocate (server-side: validates availableQuantity, decrements stock, creates stock history, marks request ALLOCATED)
- `PATCH /api/allocations/[id]` — update status (DELIVERED → request COMPLETED)

### Shelters
- `GET /api/shelters` — list
- `POST /api/shelters` — register
- `GET /api/shelters/[id]` — detail with occupancy logs
- `PATCH /api/shelters/[id]` — update (occupancy never exceeds capacity; occupancy log written)

### Teams
- `GET /api/teams` — list
- `POST /api/teams` — create

### Volunteer Tasks
- `GET /api/tasks` — list (volunteers see only own tasks)
- `POST /api/tasks` — create (Coordinator/Admin)
- `PATCH /api/tasks/[id]` — update (volunteer only own tasks; field report/photos)

### Notifications
- `GET /api/notifications` — list for current user
- `PATCH /api/notifications/[id]` — mark read

### Analytics
- `GET /api/analytics` — dashboard metrics: active incidents, affected people, pending requests, available resources, active shelters, available volunteers, average time to first verification/response in minutes, category distribution, daily request trends, and resource distribution. Relief-organization metrics are scoped to that organization where applicable.

## Error Responses

`{ "error": "<message>" }` with appropriate HTTP status (400, 401, 403, 404).
