# ReliefGrid — API Documentation

Base URL: `http://localhost:3000`
Auth: NextAuth.js JWT session cookie (`next-auth.session-token`). All `/api/*` routes require a valid session unless noted.

## Authentication

- `POST /api/auth/login` — NextAuth credentials sign-in (handled by NextAuth handler at `/api/auth/[...nextauth]`)
- `POST /api/auth/register` — register a new user (VOLUNTEER or RELIEF_ORGANIZATION)
- `GET /api/me` — current authenticated user
- `POST /api/auth/signout` — sign out

## Common Query Parameters

List endpoints support: `page` (default 1), `pageSize` (default 10, max 100), `search`.

Responses are shaped `{ data, total, page, pageSize }`.

## Endpoints

### Organizations
- `GET /api/organizations` — list (System Admin sees all; others see own)
- `POST /api/organizations` — create (System Admin)
- `GET /api/organizations/[id]` — get (System Admin)
- `PUT /api/organizations/[id]` — update (System Admin)
- `DELETE /api/organizations/[id]` — delete (System Admin)

### Users
- `GET /api/users` — list (RBAC filtered by org/role)
- `GET /api/users/[id]` — get one
- `PATCH /api/users/[id]` — update (Admin/Coordinator scope)

### Incidents
- `GET /api/incidents` — list, sorted by priorityScore desc
- `POST /api/incidents` — create
- `GET /api/incidents/[id]` — detail with history, requests, tasks
- `PATCH /api/incidents/[id]` — update (tracked in IncidentHistory)
- `DELETE /api/incidents/[id]` — delete (System Admin)

### Emergency Requests
- `GET /api/requests` — list, sorted by priorityScore desc
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
- `GET /api/analytics` — dashboard metrics: active incidents, affected people, pending requests, available resources, active shelters, available volunteers, category distribution, request trends, resource distribution.

## Error Responses

`{ "error": "<message>" }` with appropriate HTTP status (400, 401, 403, 404).
