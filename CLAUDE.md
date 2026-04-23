# Work Item Editor

A system for tracking what people are working on. Consists of a Rust API server (`api/`) and a React frontend (`ui/`), deployed to GCP Cloud Run with a PostgreSQL Cloud SQL database.

## Repository Structure

```
work-item-editor/
├── api/          # Rust API server (Axum + SQLx + utoipa)
├── ui/           # React frontend
└── CLAUDE.md
```

---

## API Server (`api/`)

### Stack

- **Runtime**: Tokio (async)
- **Web framework**: Axum
- **Database**: SQLx with PgPool (PostgreSQL / Cloud SQL)
- **OpenAPI**: utoipa + utoipa-swagger-ui (Axum feature)
- **HTTP middleware**: tower-http (fs, trace, cors)
- **Serialization**: serde, serde_json
- **Logging/tracing**: tracing, tracing-subscriber

### Cargo Dependencies

```toml
[dependencies]
axum = "0.7"
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "macros", "uuid", "chrono"] }
utoipa = { version = "4", features = ["axum_extras", "uuid", "chrono"] }
utoipa-swagger-ui = { version = "7", features = ["axum"] }
tower-http = { version = "0.5", features = ["fs", "trace", "cors"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
dotenvy = "0.15"

[dev-dependencies]
tower = { version = "0.4", features = ["util"] }
```

### Database Schema

```sql
CREATE TABLE epic (
    id          uuid DEFAULT gen_random_uuid() NOT NULL CONSTRAINT epic_pk PRIMARY KEY,
    name        text,
    created_at  timestamp with time zone,
    modified_at timestamp with time zone
);

CREATE TABLE team_member (
    id           uuid DEFAULT gen_random_uuid() NOT NULL CONSTRAINT team_member_pk PRIMARY KEY,
    name         text,
    created_at   timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at   timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_epic_id uuid CONSTRAINT team_member_epic_id_fk REFERENCES epic
);

CREATE TABLE work_item (
    id             uuid DEFAULT gen_random_uuid() NOT NULL CONSTRAINT work_item_pk PRIMARY KEY,
    description    text,
    team_member_id uuid CONSTRAINT work_item_team_member_id_fk REFERENCES team_member,
    epic_id        uuid CONSTRAINT work_item_epic_id_fk REFERENCES epic,
    percent_of_day integer,
    created_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
```

### API Design

The server exposes a CRUD REST API for three resources:

| Resource      | Base Path        |
|---------------|-----------------|
| Epics         | `/api/epics`     |
| Team Members  | `/api/team-members` |
| Work Items    | `/api/work-items` |

Standard CRUD operations per resource:
- `GET    /api/{resource}`        — list all (epics and team members sorted alphabetically by name, nulls last)
- `POST   /api/{resource}`        — create
- `GET    /api/{resource}/{id}`   — get by ID
- `PUT    /api/{resource}/{id}`   — full update
- `DELETE /api/{resource}/{id}`   — delete

OpenAPI docs served at `/swagger-ui` via utoipa-swagger-ui.

### Configuration

Configuration is read from environment variables:

| Variable       | Description                          |
|----------------|--------------------------------------|
| `DATABASE_URL`  | PostgreSQL connection string         |
| `PORT`          | HTTP port (default: `8080`)          |
| `RUST_LOG`      | Log level filter (default: `info`)   |

For Cloud SQL (Cloud Run), use the Unix socket path:
```
DATABASE_URL=postgresql://user:password@/dbname?host=/cloudsql/PROJECT:REGION:INSTANCE
```

### Database Migrations

Use SQLx migrations in `api/migrations/`. Run with:

```bash
sqlx migrate run
```

Always write migrations as `up` scripts only. Do not use reversible migrations.

### Code Organization

```
api/src/
├── main.rs          # App entry point, router setup, DB pool init
├── db.rs            # PgPool initialization
├── models/          # Structs for DB rows and API request/response
│   ├── epic.rs
│   ├── team_member.rs
│   └── work_item.rs
├── handlers/        # Axum handler functions per resource
│   ├── epics.rs
│   ├── team_members.rs
│   └── work_items.rs
└── errors.rs        # Unified error type implementing IntoResponse
```

### Error Handling

Define a unified `AppError` type in `errors.rs` that implements `axum::response::IntoResponse`. Map `sqlx::Error` variants to appropriate HTTP status codes (404 for not found, 409 for conflicts, 500 for unexpected errors).

---

## Testing

### Integration Tests (Required)

Integration tests are the primary testing mechanism for the API. Unit tests alone are not sufficient — all handler logic must be covered by integration tests that run against a real PostgreSQL database.

- Integration tests live in `api/tests/`
- Each test file corresponds to a resource (e.g., `tests/epics.rs`, `tests/team_members.rs`, `tests/work_items.rs`)
- Tests use `#[sqlx::test]` which automatically creates and tears down an isolated database per test — no manual cleanup needed
- Tests must cover: create, read (single and list), update, delete, and not-found error cases
- The shared `MIGRATOR` is defined in `lib.rs` and referenced as `#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]`

### Running Tests

```bash
# From api/
cargo test
```

`DATABASE_URL` must point to a Postgres server where the user can create and drop databases. No separate test database setup is needed — `#[sqlx::test]` handles it automatically.

### CI Expectations

- All tests must pass before merging
- Tests run against a real Postgres instance (not mocked)
- `DATABASE_URL` must be set in CI

---

## Deployment

### Cloud Run

The API is containerized and deployed to GCP Cloud Run. Key requirements:

- Listen on `$PORT` (Cloud Run sets this; default `8080`)
- Connect to Cloud SQL via Unix socket (use Cloud SQL Auth Proxy or direct socket mount)
- Use `RUST_LOG` for structured log output

### Dockerfile (api/)

Use a multi-stage build:
1. Stage 1: `rust` builder image — compile release binary
2. Stage 2: `debian:bookworm-slim` — copy binary and run

---

## Frontend (`ui/`)

### Stack

- **Build tool**: Vite
- **Framework**: React 19 with TypeScript
- **Routing**: React Router v7 (`createBrowserRouter`)
- **Data fetching**: TanStack Query v5
- **UI components**: shadcn/ui (Radix-based, Tailwind-styled)
- **Styling**: Tailwind CSS v4

### Code Organization

```
ui/src/
├── layouts/
│   └── root-layout.tsx   # Sidebar nav + <Outlet /> wrapper
├── pages/
│   ├── home.tsx
│   ├── epics.tsx
│   ├── team-members.tsx
│   └── work-items.tsx
├── lib/
│   └── api.ts            # Typed fetch wrappers for all API endpoints
├── components/
│   └── ui/               # shadcn components (button, input, …)
└── main.tsx              # Router + QueryClientProvider setup
```

### API Client (`lib/api.ts`)

All API calls go through typed wrappers in `lib/api.ts`. Each resource has a plain object (`epicsApi`, `teamMembersApi`, etc.) with `list`, `create`, `update`, and `delete` methods. They call a shared `request<T>` helper that handles `Content-Type`, error throwing, and the 204 no-body case. Pages import these and pass them directly to `useMutation` / `useQuery`.

The Vite dev server proxies `/api/*` to `http://localhost:8080` so the UI and API can run on separate ports without CORS issues.

### UI Patterns

- **Inline editing**: clicking a row's text replaces it with a focused `<Input>`. Enter or blur commits; Escape restores the original value. This avoids modals for simple edits.
- **Adding rows**: "Add" button appends a `NewItemRow` component with a focused empty input below the list. Enter creates; Escape or empty blur dismisses.
- **Optimistic-free**: mutations call `invalidateQueries` on success — no manual cache updates. The latency is acceptable and it keeps mutation code simple.

---

## Testing

### API Integration Tests

Integration tests are the primary testing mechanism for the API. Unit tests alone are not sufficient — all handler logic must be covered by integration tests that run against a real PostgreSQL database.

- Integration tests live in `api/tests/`
- Each test file corresponds to a resource (e.g., `tests/epics.rs`, `tests/team_members.rs`, `tests/work_items.rs`)
- Tests use `#[sqlx::test]` which automatically creates and tears down an isolated database per test — no manual cleanup needed
- Tests must cover: create, read (single and list), update, delete, and not-found error cases
- The shared `MIGRATOR` is defined in `lib.rs` and referenced as `#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]`

```bash
# From api/
cargo test
```

`DATABASE_URL` must point to a Postgres server where the user can create and drop databases. `#[sqlx::test]` handles database creation and teardown automatically.

### UI Unit Tests (Vitest + React Testing Library + MSW)

Component-level tests that run entirely in Node — no browser, no server required.

```bash
# From ui/
npm test          # run once
npm run test:watch  # watch mode
```

**Key files:**
```
ui/src/test/
├── setup.ts       # jest-dom matchers + MSW lifecycle (beforeAll/afterEach/afterAll)
├── handlers.ts    # MSW request handlers with fixture data for all endpoints
├── server.ts      # MSW Node server instance
└── render.tsx     # renderWithProviders() — wraps components in QueryClientProvider
```

**Design choices:**
- **`include: ["src/**/*.{test,spec}.{ts,tsx}"]` in `vite.config.ts`** scopes Vitest to `src/` only. Without this, Vitest picks up `e2e/*.spec.ts` (Playwright files) and fails because Playwright's `test.afterEach` API is incompatible with Vitest.
- **MSW intercepts at the network boundary**, not by mocking `fetch` or the API module. The component code is identical to production; only the HTTP responses differ. This means routing, React Query caching, and loading/error states are all exercised.
- **`retry: false` on the test QueryClient** prevents Vitest from hanging while React Query retries failed requests in error-state tests.
- **Each test file gets a fresh QueryClient** via `renderWithProviders`, so cached data from one test never leaks into another.
- **`server.resetHandlers()` in `afterEach`** restores the default handlers after any test that overrides them with `server.use(...)`.

### UI End-to-End Tests (Playwright)

Full-stack browser tests against the real running API and database. Nothing is mocked.

```bash
# From ui/ — requires both the API server and Cloud SQL proxy to be running
npm run test:e2e
```

**Design choices:**
- **`fullyParallel: false`**: tests run serially because they share a real database. Parallel execution would cause race conditions on list queries that assert on specific items.
- **`reuseExistingServer: true`**: Playwright uses the already-running Vite dev server instead of starting a new one. If the dev server isn't running it will start one automatically.
- **`[e2e]` prefix on test data**: every item created by a test is named `[e2e] …`. The `afterEach` hook queries the API and deletes any items whose name starts with `[e2e]`, so test runs never leave permanent data in the database.
- **API request context for setup/teardown**: test fixtures are created and cleaned up via `request` (Playwright's API client) rather than through the UI. This keeps tests focused — a delete test doesn't also test create, and a create test doesn't need to navigate to clean up.
- **Tests are independent of existing data**: assertions only reference items created within the current test, so the tests pass regardless of what's already in the database.

---

## Development Setup

### Prerequisites

- Rust (stable, via rustup)
- Cloud SQL Auth Proxy (for local development against Cloud SQL)
- `sqlx-cli`: `cargo install sqlx-cli --no-default-features --features rustls,postgres`
- Node.js 20+

### Starting Everything Locally

**1. Start the Cloud SQL proxy** (in its own terminal):

```bash
cloud-sql-proxy <PROJECT>:<REGION>:<INSTANCE> --port 5434
```

**2. Start the API server** (in its own terminal):

```bash
cd api
cargo run
# API available at http://localhost:8080
# Swagger UI at http://localhost:8080/swagger-ui
```

The server loads `api/.env` automatically via `dotenvy`. Create it if it doesn't exist:
```
DATABASE_URL=postgresql://user:password@localhost:5434/dbname
```
Special characters in the password must be percent-encoded.

**3. Start the UI dev server** (in its own terminal):

```bash
cd ui
npm install
npm run dev
# UI available at http://localhost:5174
# /api/* requests are proxied to http://localhost:8080
```

### Running All Tests

```bash
# API integration tests (requires Cloud SQL proxy + DATABASE_URL)
cd api && cargo test

# UI unit tests (no server needed)
cd ui && npm test

# UI end-to-end tests (requires API server + Cloud SQL proxy + ui dev server)
cd ui && npm run test:e2e
```
