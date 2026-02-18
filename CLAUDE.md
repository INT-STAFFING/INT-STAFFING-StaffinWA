# CLAUDE.md — Staffing Allocation Planner

## Project Overview

A comprehensive staffing and resource allocation management application for planning, monitoring, and optimizing human resource allocation on company projects. The UI is in **Italian** — all labels, messages, and user-facing strings use Italian language.

**Tech stack:** React 19 + TypeScript + Tailwind CSS (Material Design 3) frontend with Vercel Serverless Functions backend and PostgreSQL (Vercel Postgres) database.

## Quick Reference

```bash
npm run dev       # Start Vite dev server on port 3000
npm run build     # TypeScript type-check (tsc --noEmit) + Vite build
npm run test      # Run Vitest tests
npm run lint      # ESLint with zero warnings tolerance
npm run seed      # Seed database (requires .env.development.local)
```

## Project Structure

This is **not** a monorepo. Most source files live at the repository root rather than inside a `src/` directory.

```
.
├── App.tsx                  # Root component: routing, layout, providers
├── index.tsx                # React DOM entry point
├── index.html               # HTML shell
├── types.ts                 # All TypeScript interfaces/types (single file)
├── routes.ts                # Route manifest and navigation configuration
├── index.css                # Global styles + Tailwind + MD3 CSS variables
│
├── api/                     # Vercel Serverless Functions (backend)
│   ├── db.ts                # PostgreSQL connection pool (@vercel/postgres)
│   ├── schema.ts            # Full database schema DDL + initialization
│   ├── data.ts              # Aggregated data fetch endpoint (/api/data)
│   ├── login.ts             # JWT authentication endpoint
│   ├── auth-config.ts       # Auth configuration endpoint
│   ├── resources.ts         # Generic CRUD dispatcher for all entities (largest API file)
│   ├── config.ts            # Config/lookup value CRUD
│   ├── allocations.ts       # Allocation management
│   ├── assignments.ts       # Assignment management
│   ├── resource-requests.ts # Resource request CRUD
│   ├── import.ts            # Excel/data import
│   └── export-sql.ts        # Data export
│
├── components/              # Reusable React components
│   ├── forms/               # Form components (FormDialog, FormFieldFeedback, configs, types)
│   ├── sidebar/             # Sidebar sub-components (SidebarHeadless, SidebarItemFactory)
│   ├── shared/              # Shared utilities (ExportButton)
│   ├── __tests__/           # Component tests
│   ├── DataTable.tsx         # Primary data table component
│   ├── Modal.tsx             # Modal dialog
│   ├── ConfirmationModal.tsx # Confirmation dialog
│   ├── ExportModal.tsx       # Export functionality modal
│   ├── VirtualStaffingGrid.tsx  # Virtualized staffing grid (@tanstack/react-virtual)
│   ├── SearchWidget.tsx      # Global search palette (Cmd+K)
│   ├── SearchableSelect.tsx  # Searchable dropdown
│   ├── MultiSelectDropdown.tsx  # Multi-select component
│   ├── GraphDataView.tsx     # D3-based graph visualization
│   ├── DashboardDataTable.tsx # Dashboard-specific table
│   ├── Pagination.tsx        # Pagination component
│   ├── Toast.tsx             # Toast notification
│   ├── LoadingSkeleton.tsx   # Loading skeleton
│   ├── ErrorBoundary.tsx     # Error boundary
│   ├── Sidebar.tsx           # Main sidebar navigation
│   ├── BottomNavBar.tsx      # Mobile bottom navigation
│   └── icons.tsx             # Icon components library
│
├── pages/                   # Page-level components (lazy-loaded)
│   ├── __tests__/           # Page tests
│   ├── StaffingPage.tsx     # Core staffing grid
│   ├── DashboardPage.tsx    # Analytics dashboard
│   ├── ResourcesPage.tsx    # Resource management
│   ├── ProjectsPage.tsx     # Project management
│   ├── ClientsPage.tsx      # Client management
│   ├── RolesPage.tsx        # Role management
│   ├── ContractsPage.tsx    # Contract management
│   ├── WbsAllocationPage.tsx # WBS analysis
│   ├── RateCardsPage.tsx    # Rate card management
│   ├── ForecastingPage.tsx  # 12-month capacity planning
│   ├── SimulationPage.tsx   # What-if staffing scenarios
│   ├── WorkloadPage.tsx     # Resource workload view
│   ├── GanttPage.tsx        # Project timeline
│   ├── CalendarPage.tsx     # Company calendar
│   ├── ResourceRequestPage.tsx  # Recruitment requisitions
│   ├── InterviewsPage.tsx   # Interview tracking
│   ├── SkillsPage.tsx       # Skills management
│   ├── SkillsMapPage.tsx    # Skills map visualization
│   ├── SkillAnalysisPage.tsx # Skill gap analysis
│   ├── CertificationsPage.tsx # Certifications
│   ├── LeavePage.tsx        # Leave request management
│   ├── PerformanceTimeline.tsx  # Performance evaluations
│   ├── RevenuePage.tsx      # Revenue analysis
│   ├── ReportsPage.tsx      # Reports
│   ├── StaffingVisualizationPage.tsx  # D3 Sankey staffing viz
│   ├── ExportPage.tsx       # Data export
│   ├── ImportPage.tsx       # Data import
│   ├── NotificationsPage.tsx # Notifications
│   ├── NotificationSettingsPage.tsx  # Notification config
│   ├── AdminSettingsPage.tsx # Admin settings
│   ├── SecurityCenterPage.tsx # Security/user management
│   ├── DbInspectorPage.tsx  # Database inspector
│   ├── ConfigPage.tsx       # App configuration
│   ├── GlobalSearchPage.tsx # Full search results
│   ├── LoginPage.tsx        # Login
│   ├── UserManualPage.tsx   # Full user manual (Italian)
│   ├── SimpleUserManualPage.tsx # Simplified manual
│   └── TestStaffingPage.tsx # Dev/testing page (no registered route)
│
├── context/                 # React Context providers (state management)
│   ├── AppContext.tsx        # Main app state — entities, allocations, CRUD ops
│   ├── AuthContext.tsx       # Authentication state, JWT, RBAC
│   ├── ThemeContext.tsx      # Dark/light theme with MD3 tokens
│   ├── RoutesContext.tsx     # Navigation manifest, breadcrumbs, permissions
│   ├── ExportContext.tsx     # Export state
│   └── ToastContext.tsx      # Toast notifications
│
├── hooks/                   # Custom React hooks
│   ├── useAuthorizedResource.ts   # Authorization check hook
│   ├── useAuthorizedResource.test.ts
│   ├── useExport.ts               # Export functionality
│   └── useGlobalSearch.ts         # Global search
│
├── services/                # API client and mock engine
│   ├── apiClient.ts         # HTTP client with auth, retries, mock interception
│   ├── mockData.ts          # Development mock data (initial state)
│   └── mockHandlers.ts      # Mock request router with localStorage persistence
│
├── utils/                   # Utility modules
│   ├── api.ts               # authorizedFetch / authorizedJsonFetch helpers
│   ├── auth.ts              # getStoredAuthToken helper
│   ├── dateUtils.ts         # Date manipulation helpers
│   ├── costUtils.ts         # Cost/budget calculations
│   ├── exportUtils.ts       # Export to Excel (xlsx)
│   ├── exportTableUtils.ts  # Table-specific export helpers
│   ├── formatters.ts        # Data formatting
│   ├── paths.ts             # Route path constants
│   └── webhookNotifier.ts   # Webhook notification integration
│
├── libs/
│   └── zod.ts               # Custom lightweight Zod-compatible validation library
│
├── config/
│   └── dashboardLayout.ts   # Dashboard widget layout config
│
├── scripts/
│   └── seed.js              # Database seeding (idempotent)
│
├── src/                     # Legacy/duplicate directory (excluded from TS compilation)
│   ├── pages/               # Contains only SkillAnalysisPage.tsx (duplicate)
│   └── routes.ts            # Duplicate routes file
│
├── tailwind.config.js       # Tailwind + MD3 color tokens via CSS variables
├── vite.config.ts           # Vite config (port 3000, path aliases)
├── tsconfig.json            # TypeScript config
├── postcss.config.js        # PostCSS (Tailwind + Autoprefixer)
├── vercel.json              # Vercel deployment (SPA rewrites)
├── metadata.json            # App metadata for deployment
└── package.json             # Dependencies and scripts
```

## Architecture & Key Patterns

### State Management

State is managed via **React Context** (no Redux/Zustand). The main provider hierarchy is:

```
HashRouter > ThemeProvider > ToastProvider > AppProviders > AuthProvider > ExportProvider > RoutesProvider
```

- **`AppContext.tsx`** is the central state store. It holds all entity data (resources, projects, clients, allocations, etc.) and exposes CRUD operations. This is the largest and most important file.
- All data is fetched on initial load via `/api/data` and cached in context state.
- CRUD operations call the API then update local state optimistically.

### Routing

- Uses **HashRouter** (`/#/path`) for compatibility with sandbox/preview environments.
- All pages are **lazy-loaded** via `React.lazy()` with `Suspense` fallbacks.
- Some named exports require the `.then(module => ({ default: module.NamedExport }))` pattern in lazy imports.
- RBAC is enforced via `DynamicRoute` wrapper that checks `AuthContext.hasPermission(path)`.
- Route metadata (labels, icons, sections, breadcrumbs) is defined in `routes.ts` and consumed via `RoutesContext`.

### API Layer

**There are only a handful of actual API files.** Most entity CRUD is routed through `api/resources.ts`, not separate per-entity files:

- **`/api/data`** — Bulk read: fetches all entities for initial load. Accepts `?scope=all|metadata`.
- **`/api/resources?entity=<type>`** — Generic CRUD dispatcher. Handles `resources`, `projects`, `clients`, `roles`, `skills`, `skill_categories`, `leaves`, `app-users`, `rate_cards`, `billing_milestones`, and many more via the `TABLE_MAPPING` and `VALIDATION_SCHEMAS` maps inside `resources.ts`.
- **`/api/config?type=<type>`** — CRUD for lookup/config values (functions, seniority levels, locations, etc.).
- **`/api/allocations`**, **`/api/assignments`** — Dedicated endpoints for allocation and assignment data.
- **`/api/resource-requests`** — Recruitment requisition endpoint.
- **`/api/login`**, **`/api/auth-config`** — Authentication.
- **`/api/import`**, **`/api/export-sql`** — Data import/export.

**Local/Preview Mode:** `apiClient.ts` detects non-production environments by checking the hostname/port and intercepts all `/api/*` calls, routing them to the in-memory mock engine (`mockHandlers.ts` + `mockData.ts`).

Mock detection triggers for: `localhost`, `127.0.0.1`, non-standard ports, `webcontainer`, `stackblitz`, `vercel-preview`, `google-ai-studio`, `usercontent.goog`, `googleusercontent.com`, hosts without a dot (intranet).

The mock engine **persists to `localStorage`** under key `staffing_planner_local_db_v1`, merging writes with `INITIAL_MOCK_DATA` on read.

API calls use `apiFetch()` from `services/apiClient.ts` which handles auth headers (Bearer JWT from `localStorage`), retries with exponential backoff, and mock interception.

### Database

- **PostgreSQL** via `@vercel/postgres` connection pool.
- Connection configured in `api/db.ts` using `POSTGRES_URL` or `NEON_POSTGRES_URL` env var.
- Schema is defined in `api/schema.ts` — raw SQL DDL, no ORM. `ensureDbTablesExist()` is called lazily on first request.
- Database seeding: `scripts/seed.js` (run via `npm run seed`). Idempotent — safe to run multiple times.
- Tables use `snake_case` naming. IDs are UUID strings generated via `uuid` package.
- `api/data.ts` performs `snake_case → camelCase` conversion on all DB results before returning JSON.

### Styling

- **Tailwind CSS** with **Material Design 3** (MD3) theming.
- Colors are defined as CSS custom properties (`--color-primary`, etc.) in `index.css` and mapped in `tailwind.config.js`.
- Dark mode via `class` strategy (`dark` class on root element).
- Font: **Manrope** (sans-serif) via Google Fonts.
- Surface elevation uses MD3 surface container tokens (`surface-container-low`, `surface-container-high`, etc.).
- Icons: **Material Symbols Outlined** from Google Fonts CDN (referenced as `<span className="material-symbols-outlined">icon_name</span>`).

### Validation

- The project uses a **custom lightweight Zod-compatible library** at `libs/zod.ts` (aliased as `zod` in both tsconfig and Vite config).
- This is NOT the full `zod` package — it's a minimal subset supporting: `object`, `string`, `boolean`, `enum`, `number`, `array`, `optional/nullable`, `refine`, `safeParse`.
- Import `zod` as usual — the alias resolves to the local implementation.
- The custom lib is used on both the **frontend** (form validation) and **backend** (`api/resources.ts` uses `z` from `'../libs/zod.js'`).

### Authentication & Authorization

- JWT-based auth with `bcryptjs` password hashing.
- JWT secret stored in `JWT_SECRET` environment variable (required in production).
- Auth token stored in `localStorage` as `authToken`.
- Auth state in `AuthContext.tsx` — provides `login`, `logout`, `changePassword`, `hasPermission`.
- RBAC roles: `SIMPLE`, `MANAGER`, `ADMIN` with path-level permissions stored in `role_permissions` table.
- Force password change on first login (`mustChangePassword` flag on user object).
- `utils/auth.ts` exports `getStoredAuthToken()`. `utils/api.ts` exports `authorizedFetch`/`authorizedJsonFetch` as lower-level alternatives to `apiFetch()`.

## TypeScript Conventions

- **All types** are defined in the root `types.ts` file — there is no per-module type splitting.
- Interfaces use `PascalCase` (e.g., `Resource`, `Project`, `Allocation`).
- Entity IDs are optional `string` fields (`id?: string`) — generated server-side. **Exception:** `Resource.id` is a required `string`.
- The `Allocation` type is a two-level nested map:
  ```typescript
  interface Allocation {
    [assignmentId: string]: {
      [date: string]: number; // percentage (0–100)
    };
  }
  ```
- Skill levels are 1–5 mapped to `NOVICE | JUNIOR | MIDDLE | SENIOR | EXPERT` via `SKILL_LEVELS` constant in `types.ts`.

### Path Aliases

- `@/*` resolves to the project root (e.g., `@/components/Modal`).
- `zod` resolves to `./libs/zod` (the custom implementation).

### TypeScript Configuration

- Target: ES2022, Module: ESNext, JSX: react-jsx.
- `noEmit: true` — TypeScript is used for type-checking only; Vite handles compilation.
- The `api/`, `scripts/`, test files, and `src/` are **excluded** from the frontend TypeScript compilation (`tsconfig.json` exclude list).

## Code Conventions

- **Language:** UI strings, comments, and documentation are predominantly in **Italian**.
- **Component style:** Functional components with hooks. No class components.
- **File naming:** `PascalCase` for components/pages (`StaffingPage.tsx`), `camelCase` for utilities (`dateUtils.ts`).
- **Exports:** Pages use both default and named exports. Some lazy imports use `.then(module => ({ default: module.NamedExport }))` pattern.
- **JSDoc:** File-level `@file` / `@description` comments (in Italian) are used on major files.
- **CSS:** Tailwind utility classes inline. MD3 semantic color tokens preferred over raw color values.
- **No Prettier config** — formatting follows defaults.
- **ESLint:** Strict mode (`--max-warnings 0`). TypeScript ESLint + React Hooks + React Refresh plugins.

## Testing

- **Framework:** Vitest + @testing-library/react + jsdom.
- **Test locations:**
  - `components/__tests__/` — component snapshot tests
  - `pages/__tests__/validationSchemas.test.ts` — validation schema tests
  - `hooks/useAuthorizedResource.test.ts` — co-located hook test
- **Run:** `npm run test` (Vitest in watch mode).
- Test coverage is minimal — limited to a few components, hooks, and validation schemas.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | Yes (prod) | PostgreSQL connection string |
| `NEON_POSTGRES_URL` | Fallback | Alternative Postgres connection string |
| `JWT_SECRET` | Yes (prod) | Secret for signing/verifying JWT tokens |
| `GEMINI_API_KEY` | No | Optional AI integration key (exposed to frontend) |

- Use `.env.development.local` for local development (git-ignored via `*.local` pattern).
- The `.env.example` file exists but is currently empty.

## Deployment

- **Platform:** Vercel.
- **Frontend:** SPA built by Vite, deployed to CDN. All non-API routes rewrite to `index.html` (see `vercel.json`).
- **Backend:** Each file in `/api/` becomes a serverless function endpoint.
- **Database:** Vercel Postgres (or Neon Postgres).

## Key Domain Concepts

- **Resource** — An employee/consultant that can be allocated to projects.
- **Project** — A client engagement with budget, timeline, and staffing needs.
- **Assignment** — Links a resource to a project (no role/date on the join itself — dates live in allocations).
- **Allocation** — Daily percentage of a resource's time allocated to a project, keyed by `assignmentId > date > percentage`.
- **Function** (formerly "Horizontal") — Business function/department a resource belongs to (e.g., Technology, Finance).
- **Seniority Level** — Career level (e.g., Junior, Senior, Manager).
- **Contract** — Legal agreement with CIG/WBS codes and billing type (T&M or Fixed Price).
- **Rate Card** — Daily billing rates per resource.
- **Resource Request** — Recruitment requisition for new hires. Status: `ATTIVA | STANDBY | CHIUSA`.
- **Interview** — Candidate record linked to a resource request. Feedback: `Positivo | Positivo On Hold | Negativo`.
- **WbsTask** — WBS (Work Breakdown Structure) financial entry tied to a client.
- **Skill** — Individual competency, optionally a certification. Proficiency level 1–5.
- **Leave Request** — Employee time-off request. Status: `PENDING | APPROVED | REJECTED`.

## Common Tasks

### Adding a new page

1. Create the page component in `pages/NewPage.tsx`.
2. Add a lazy import in `App.tsx`.
3. Add a `<Route>` entry wrapped in `<DynamicRoute>` in `AppContent`.
4. Register the route in `routes.ts` with label, icon, section, and permissions.

### Adding a new entity type

**If the entity can use the generic CRUD dispatcher (`api/resources.ts`):**
1. Add a `TABLE_MAPPING` entry (frontend entity name → DB table name) in `api/resources.ts`.
2. Add a `VALIDATION_SCHEMAS` entry with a Zod schema in `api/resources.ts`.
3. Define the TypeScript interface in `types.ts`.
4. Add state and CRUD operations to `context/AppContext.tsx`.
5. Include the entity in `api/data.ts` bulk fetch.
6. Add mock data to `services/mockData.ts`.

**If the entity needs a dedicated endpoint:**
1. Create a new file in `api/` (e.g., `api/my-endpoint.ts`).
2. Export a default async handler: `export default async function handler(req, res)`.
3. Use `db` from `api/db.ts` for database queries.
4. The endpoint is automatically available at `/api/my-endpoint` on Vercel.
5. Add a mock handler branch in `services/mockHandlers.ts`.

### Adding a new API endpoint

1. Create a new file in `api/` (e.g., `api/my-endpoint.ts`).
2. Export a default async handler: `export default async function handler(req, res)`.
3. Use `db` from `api/db.ts` for database queries.
4. The endpoint is automatically available at `/api/my-endpoint` on Vercel.

### Running locally without a database

The app automatically falls back to mock mode when running on localhost or preview environments. The mock engine in `services/mockHandlers.ts` handles all `/api/*` calls with initial data from `services/mockData.ts`, persisting mutations to `localStorage` (`staffing_planner_local_db_v1`).
