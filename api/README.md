# Work Item Editor — API Server

REST API for tracking what team members are working on, organized by epics and work items. Built with Rust (Axum + SQLx), deployed to GCP Cloud Run with a PostgreSQL Cloud SQL backend.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/epics` | List all epics |
| POST | `/api/epics` | Create an epic |
| GET | `/api/epics/:id` | Get an epic |
| PUT | `/api/epics/:id` | Update an epic |
| DELETE | `/api/epics/:id` | Delete an epic |
| GET | `/api/team-members` | List all team members |
| POST | `/api/team-members` | Create a team member |
| GET | `/api/team-members/:id` | Get a team member |
| PUT | `/api/team-members/:id` | Update a team member |
| DELETE | `/api/team-members/:id` | Delete a team member |
| GET | `/api/work-items` | List all work items |
| POST | `/api/work-items` | Create a work item |
| GET | `/api/work-items/:id` | Get a work item |
| PUT | `/api/work-items/:id` | Update a work item |
| DELETE | `/api/work-items/:id` | Delete a work item |
| GET | `/swagger-ui` | Interactive API docs |

## Prerequisites

- Rust (stable) — install via [rustup](https://rustup.rs)
- PostgreSQL
- sqlx-cli:
  ```bash
  cargo install sqlx-cli --no-default-features --features rustls,postgres
  ```

## Local Development

**1. Configure the database connection**

Create `api/.env` (already gitignored):

```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/work_item_editor_dev
```

Special characters in the password must be [percent-encoded](https://developer.mozilla.org/en-US/docs/Glossary/Percent-encoding) — e.g. `(` → `%28`, `$` → `%24`, `+` → `%2B`, `^` → `%5E`.

**2. Run migrations**

```bash
cargo sqlx migrate run
```

**3. Start the server**

```bash
cargo run
```

The server listens on `http://localhost:8080` by default. Swagger UI is at `http://localhost:8080/swagger-ui`.

## Configuration

All configuration is via environment variables (or `.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `PORT` | `8080` | HTTP listen port |
| `RUST_LOG` | `info` | Log level filter (`trace`, `debug`, `info`, `warn`, `error`) |

## Running Tests

Tests are full integration tests — each test gets its own isolated database created and torn down automatically via `#[sqlx::test]`.

```bash
cargo test
```

`DATABASE_URL` must be set and point to a Postgres server where the connecting user can create and drop databases (the `postgres` superuser works).

To run a specific suite:

```bash
cargo test --test epics
cargo test --test team_members
cargo test --test work_items
```

## Database Migrations

Migrations live in `migrations/` and are managed by sqlx-cli.

```bash
# Apply pending migrations
cargo sqlx migrate run

# Check migration status
cargo sqlx migrate info

# Add a new migration
cargo sqlx migrate add <description>
```

## Deployment (GCP Cloud Run)

The server reads `PORT` from the environment, which Cloud Run sets automatically.

For Cloud SQL, use the Unix socket connection string:

```
DATABASE_URL=postgresql://user:password@/dbname?host=/cloudsql/PROJECT:REGION:INSTANCE
```

Build and push the container image, then deploy:

```bash
gcloud run deploy work-item-editor-api \
  --image gcr.io/PROJECT/work-item-editor-api \
  --add-cloudsql-instances PROJECT:REGION:INSTANCE \
  --set-env-vars DATABASE_URL=... \
  --region REGION
```

## Project Structure

```
api/
├── migrations/          # SQLx migration files
├── src/
│   ├── main.rs          # Entry point: tracing init, pool, serve
│   ├── lib.rs           # create_app(), router, OpenAPI doc, MIGRATOR
│   ├── db.rs            # PgPool creation from DATABASE_URL
│   ├── errors.rs        # AppError → HTTP response mapping
│   ├── models/          # Request/response structs (serde + utoipa)
│   │   ├── epic.rs
│   │   ├── team_member.rs
│   │   └── work_item.rs
│   └── handlers/        # Axum handler functions
│       ├── epics.rs
│       ├── team_members.rs
│       └── work_items.rs
└── tests/               # Integration tests (one file per resource)
    ├── epics.rs
    ├── team_members.rs
    └── work_items.rs
```
