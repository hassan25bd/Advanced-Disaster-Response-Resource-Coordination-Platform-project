# ReliefGrid — Disaster Response & Resource Coordination Platform

ReliefGrid is a full-stack emergency management platform built with Next.js (App Router), TypeScript, Tailwind CSS, PostgreSQL (Prisma), NextAuth.js, Recharts, and Leaflet. It enables emergency response organizations, relief teams, volunteers, and shelter managers to coordinate disaster response through a centralized system.

**Live website:** https://reliefgrid-indol.vercel.app
**Source repository:** https://github.com/hassan25bd/Advanced-Disaster-Response-Resource-Coordination-Platform-project

## Development Demo Credentials

These credentials are for local development only. Production seeding requires a unique `SEED_PASSWORD`.

| Role | Email | Capabilities |
|------|-------|--------------|
| System Admin | admin@reliefgrid.org | Manage orgs, users, monitor all activities |
| Emergency Coordinator | coordinator@reliefgrid.org | Verify incidents, assign priorities, allocate resources |
| Relief Organization | organization@reliefgrid.org | Manage resources, requests, distribution |
| Volunteer | volunteer@reliefgrid.org | View/update assigned tasks, field reports |
| Shelter Manager | shelter@reliefgrid.org | Manage shelter capacity & occupancy |

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL (Prisma ORM)
- **Auth:** NextAuth.js (Credentials provider, JWT sessions)
- **Charts:** Recharts
- **Maps:** Leaflet / react-leaflet
- **Seed:** `prisma/seed.ts` (5 orgs, 50 incidents, 100 requests, 20 shelters, 100 volunteers, 500 resources)

## Project Structure

```
src/
  app/
    page.tsx              # redirect to login/dashboard
    login/, register/     # auth pages
    dashboard/            # analytics dashboard (charts)
    incidents/            # list, create, [id] details
    requests/             # list, create, and detail
    resources/            # inventory list, registration, and detail
    allocations/          # list, create, and distribution detail
    shelters/             # list, registration, and capacity/history detail
    volunteers/           # volunteer directory
    teams/                # team list, creation, and deployment detail
    tasks/                # task list, assignment, field reports, and photographs
    notifications/        # per-user notification center
    map/                  # live incident map
    reports/              # analytics & export
    users/                # user management
    profile/              # profile settings
    api/                  # REST API routes (NextAuth, incidents, requests, ...)
  components/
    layout.tsx, navbar.tsx, session-wrapper.tsx, ui.tsx
  lib/
    prisma.ts, auth.ts, api-auth.ts, api.ts
prisma/
  schema.prisma           # full data model
  seed.ts                 # sample data generator
  seed-organization-demo.mts # additive, organization-scoped sample data
```

## Getting Started

### Prerequisites
- Node.js 20.9+
- PostgreSQL (running locally)

### Install
```bash
cd reliefgrid
npm install
```

### Environment
Copy `.env.example` to `.env` and set:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reliefgrid?schema=public"
AUTH_SECRET="change-in-production-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"
```
For production, configure both variables in the hosting provider. Use a strong random `AUTH_SECRET` and set `NEXTAUTH_URL` to the canonical deployed URL; changing the secret signs out existing sessions.
For serverless production deployments, set `DATABASE_URL_POOLED` to the database provider's pooled connection URL. The runtime prefers it and limits each function instance to one connection; `DATABASE_URL` remains the fallback for local development.

### Database
```bash
npx prisma db push          # create tables from schema
npx tsx prisma/seed.ts      # load sample data (password: ReliefGrid@2026)
```

To add a separate sample dataset to one existing organization, set `DATABASE_URL` to the intended database and run the explicit organization ID through a dry run before applying:
```bash
npx --yes tsx prisma/seed-organization-demo.mts <organization-id> --dry-run
npx --yes tsx prisma/seed-organization-demo.mts <organization-id> --apply
```
The operation is additive and idempotency-guarded; generated volunteer and shelter-manager accounts use random undisclosed passwords and are sample profiles rather than demo login credentials.
The generated shared sample records (including 12 teams, 60 tasks, and 40 allocations) are visible in read-only views to every authenticated role, so they remain available when users sign in with different accounts. Live organization records stay scoped to their organization, and shared sample records cannot be edited or deleted through the application.

### Run
```bash
npm run dev                 # http://localhost:3000
npm run build               # production build
npm run start               # production server
npm run lint                # eslint
```

## Core Features

- **Incident Management:** report, categorize (Flood, Cyclone, Earthquake, Fire, Landslide, Infrastructure Failure), severity, coordinator-assessed location risk, GPS, image, history, searchable priority-ranked pagination.
- **Emergency Requests:** Food, Water, Medical, Shelter, Rescue, Transportation; verification, location-risk and age-aware prioritization, duplicate detection, searchable pagination.
- **Resource Management:** organization-scoped registration and editing, searchable paginated stock, availability, movement history.
- **Resource Allocation:** validates available stock and remaining request quantity, updates inventory transactionally, restores stock on cancellation, preserves status history and QR verification codes.
- **Shelter Management:** capacity and occupancy validation, occupancy history, manager-scoped access.
- **Volunteer & Team Management:** team creation/lead assignment, task assignment and status transitions, field reports, bounded image uploads, activity history.
- **Notifications:** per-user inbox, unread count, assignment and allocation status alerts.
- **Priority Management:** server-calculated scores account for severity/urgency, affected population, location risk, and elapsed time; priority changes are audited.
- **Analytics Dashboard:** Recharts charts, daily request trends, organization-scoped metrics, and average time to first incident verification/response.
- **Map View:** Leaflet map with incident & shelter markers.
- **RBAC:** 5 roles, route & API-level authorization.
- **Notifications & Activity Logs:** per-user notifications, system activity audit trail.
- **Operational freshness:** dashboard, incident, and request views refresh automatically every 15 seconds while open; responsive layouts include loading, error, and empty states.

## API Documentation

See `API_DOCS.md` for endpoint details and `BUSINESS_LOGIC.md` for mandatory business rules.

## License

MIT
