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
│   ├── data.ts              # Aggregated data fetch endpoint
│   ├── login.ts             # JWT authentication endpoint
│   ├── auth-config.ts       # Auth configuration endpoint
│   ├── resources.ts         # Resource CRUD (largest API file)
│   ├── projects.ts          # Project CRUD
│   ├── clients.ts           # Client CRUD
│   ├── allocations.ts       # Allocation management
│   ├── assignments.ts       # Assignment management
│   ├── import.ts            # Excel/data import
│   ├── export-sql.ts        # Data export
│   └── ...                  # Other entity endpoints
│
├── components/              # Reusable React components
│   ├── forms/               # Form components (FormDialog, FormFieldFeedback)
│   ├── sidebar/             # Sidebar sub-components (headless, factory)
│   ├── shared/              # Shared utilities (ExportButton)
│   ├── __tests__/           # Component tests
│   ├── DataTable.tsx         # Primary data table component
│   ├── Modal.tsx             # Modal dialog
│   ├── VirtualStaffingGrid.tsx  # Virtualized staffing grid (@tanstack/react-virtual)
│   ├── SearchWidget.tsx      # Global search palette (Cmd+K)
│   └── ...
│
├── pages/                   # Page-level components (lazy-loaded)
│   ├── __tests__/           # Page tests
│   ├── StaffingPage.tsx     # Core staffing grid
│   ├── DashboardPage.tsx    # Analytics dashboard
│   ├── ResourcesPage.tsx    # Resource management
│   ├── ProjectsPage.tsx     # Project management
│   └── ...                  # ~35+ pages total
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
│   ├── useAuthorizedResource.ts
│   ├── useExport.ts
│   └── useGlobalSearch.ts
│
├── services/                # API client and mock engine
│   ├── apiClient.ts         # HTTP client with auth, retries, mock interception
│   ├── mockData.ts          # Development mock data
│   └── mockHandlers.ts      # Mock request router for local preview
│
├── utils/                   # Utility modules
│   ├── dateUtils.ts         # Date manipulation helpers
│   ├── costUtils.ts         # Cost/budget calculations
│   ├── exportUtils.ts       # Export to Excel (xlsx)
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
├── tailwind.config.js       # Tailwind + MD3 color tokens via CSS variables
├── vite.config.ts           # Vite config (port 3000, path aliases)
├── tsconfig.json            # TypeScript config
├── postcss.config.js        # PostCSS (Tailwind + Autoprefixer)
├── vercel.json              # Vercel deployment (SPA rewrites)
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
- RBAC is enforced via `DynamicRoute` wrapper that checks `AuthContext.hasPermission(path)`.
- Route metadata (labels, icons, sections, breadcrumbs) is defined in `routes.ts` and consumed via `RoutesContext`.

### API Layer

- **Production:** Vercel Serverless Functions in `/api/` directory. Each file exports a default handler.
- **Local/Preview:** The `apiClient.ts` detects non-production environments and intercepts all `/api/*` calls, routing them to the in-memory mock engine (`mockHandlers.ts` + `mockData.ts`).
- API calls use `apiFetch()` from `services/apiClient.ts` which handles auth headers, retries with exponential backoff, and mock interception.

### Database

- **PostgreSQL** via `@vercel/postgres` connection pool.
- Connection configured in `api/db.ts` using `POSTGRES_URL` or `NEON_POSTGRES_URL` env var.
- Schema is defined in `api/schema.ts` — raw SQL DDL, no ORM.
- Database seeding: `scripts/seed.js` (run via `npm run seed`).
- Tables use `snake_case` naming. IDs are UUID strings generated via `uuid` package.

### Styling

- **Tailwind CSS** with **Material Design 3** (MD3) theming.
- Colors are defined as CSS custom properties (`--color-primary`, etc.) in `index.css` and mapped in `tailwind.config.js`.
- Dark mode via `class` strategy (`dark` class on root element).
- Font: **Manrope** (sans-serif).
- Surface elevation uses MD3 surface container tokens (`surface-container-low`, `surface-container-high`, etc.).

### Validation

- The project uses a **custom lightweight Zod-compatible library** at `libs/zod.ts` (aliased as `zod` in both tsconfig and Vite config).
- This is NOT the full `zod` package — it's a minimal subset supporting: `object`, `string`, `boolean`, `enum`, `number`, `optional/nullable`, `refine`, `safeParse`.
- Import `zod` as usual — the alias resolves to the local implementation.

### Authentication & Authorization

- JWT-based auth with `bcryptjs` password hashing.
- Auth state in `AuthContext.tsx` — provides `login`, `logout`, `changePassword`, `hasPermission`.
- RBAC roles: `SIMPLE`, `MANAGER`, `ADMIN` with path-level permissions stored in `role_permissions` table.
- Force password change on first login.

## TypeScript Conventions

- **All types** are defined in the root `types.ts` file — there is no per-module type splitting.
- Interfaces use `PascalCase` (e.g., `Resource`, `Project`, `Allocation`).
- Entity IDs are optional `string` fields (`id?: string`) — generated server-side.
- The `Allocation` type is a nested map: `Record<string, Record<string, Record<string, number>>>` (resourceId > projectId > date > percentage).

### Path Aliases

- `@/*` resolves to the project root (e.g., `@/components/Modal`).
- `zod` resolves to `./libs/zod` (the custom implementation).

### TypeScript Configuration

- Target: ES2022, Module: ESNext, JSX: react-jsx.
- `noEmit: true` — TypeScript is used for type-checking only; Vite handles compilation.
- The `api/`, `scripts/`, and test files are **excluded** from the frontend TypeScript compilation (`tsconfig.json` exclude list).

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
  - `pages/__tests__/` — page-level tests (e.g., validation schemas)
  - `hooks/` — co-located test files (e.g., `useAuthorizedResource.test.ts`)
- **Run:** `npm run test` (Vitest in watch mode).
- Test coverage is minimal — limited to a few components, hooks, and validation schemas.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | Yes (prod) | PostgreSQL connection string |
| `NEON_POSTGRES_URL` | Fallback | Alternative Postgres connection string |
| `GEMINI_API_KEY` | No | Optional AI integration key |

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
- **Assignment** — Links a resource to a project (with role and date range).
- **Allocation** — Daily percentage of a resource's time allocated to a project.
- **Function** (formerly "Horizontal") — Business function/department a resource belongs to.
- **Seniority Level** — Career level (e.g., Junior, Senior, Manager).
- **Contract** — Legal agreement with WBS codes and billing type (T&M or Fixed Price).
- **Rate Card** — Daily billing rates per resource.
- **Resource Request** — Recruitment requisition for new hires.

## Common Tasks

### Adding a new page

1. Create the page component in `pages/NewPage.tsx`.
2. Add a lazy import in `App.tsx`.
3. Add a `<Route>` entry wrapped in `<DynamicRoute>` in `AppContent`.
4. Register the route in `routes.ts` with label, icon, section, and permissions.

### Adding a new API endpoint

1. Create a new file in `api/` (e.g., `api/my-endpoint.ts`).
2. Export a default async handler: `export default async function handler(req, res)`.
3. Use `db` from `api/db.ts` for database queries.
4. The endpoint is automatically available at `/api/my-endpoint` on Vercel.

### Adding a new entity type

1. Define the TypeScript interface in `types.ts`.
2. Add state and CRUD operations to `context/AppContext.tsx`.
3. Create the database table DDL in `api/schema.ts`.
4. Add the API endpoint in `api/`.
5. Include the entity in the data fetch endpoint (`api/data.ts`).

### Running locally without a database

The app automatically falls back to mock mode when running on localhost or preview environments. The mock engine in `services/mockHandlers.ts` handles all `/api/*` calls with in-memory data from `services/mockData.ts`.
