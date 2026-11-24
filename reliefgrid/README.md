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
    requests/             # emergency requests list
    resources/            # resource inventory
    allocations/          # resource allocation
    shelters/             # shelter management
    volunteers/           # volunteer directory
    teams/                # response teams
    tasks/                # volunteer tasks
    map/                  # live incident map
    reports/              # analytics & export
    users/                # user management
    profile/              # profile settings
    api/                  # REST API routes (NextAuth, incidents, requests, ...)
  components/
    layout.tsx, navbar.tsx, sidebar.tsx, session-wrapper.tsx, ui.tsx
  lib/
    prisma.ts, auth.ts, api-auth.ts, api.ts
prisma/
  schema.prisma           # full data model
  seed.ts                 # sample data generator
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

### Database
```bash
npx prisma db push          # create tables from schema
npx tsx prisma/seed.ts      # load sample data (password: ReliefGrid@2026)
```

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
- **Resource Management:** register resources, stock tracking, availability, movement history.
- **Resource Allocation:** server-side validation (cannot exceed available quantity), automatic stock decrement, allocation history, QR verification codes.
- **Shelter Management:** capacity, occupancy, available capacity validation, occupancy logs.
- **Volunteer & Team Management:** registration, teams, task assignment, field reports/photos, completion tracking.
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
