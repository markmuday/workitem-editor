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
- `GET    /api/{resource}`        — list all
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

React frontend. Implementation details TBD. Will consume the API server.

---

## Development Setup

### Prerequisites

- Rust (stable, via rustup)
- PostgreSQL running locally or Cloud SQL proxy
- `sqlx-cli`: `cargo install sqlx-cli --no-default-features --features rustls,postgres`
- Node.js (for `ui/`)

### Local API Dev

Create `api/.env` (gitignored) with your `DATABASE_URL`. Special characters in the password must be percent-encoded. Then:

```bash
cd api
cargo sqlx migrate run
cargo run
```

The server loads `.env` automatically at startup via `dotenvy`.

API will be available at `http://localhost:8080`.
Swagger UI at `http://localhost:8080/swagger-ui`.
