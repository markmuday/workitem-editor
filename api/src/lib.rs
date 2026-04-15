pub mod db;
pub mod errors;
pub mod handlers;
pub mod models;

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!();

use axum::{routing::get, Router};
use sqlx::PgPool;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::epics::list_epics,
        handlers::epics::create_epic,
        handlers::epics::get_epic,
        handlers::epics::update_epic,
        handlers::epics::delete_epic,
        handlers::team_members::list_team_members,
        handlers::team_members::create_team_member,
        handlers::team_members::get_team_member,
        handlers::team_members::update_team_member,
        handlers::team_members::delete_team_member,
        handlers::work_items::list_work_items,
        handlers::work_items::create_work_item,
        handlers::work_items::get_work_item,
        handlers::work_items::update_work_item,
        handlers::work_items::delete_work_item,
    ),
    components(schemas(
        models::epic::Epic,
        models::epic::CreateEpic,
        models::epic::UpdateEpic,
        models::team_member::TeamMember,
        models::team_member::CreateTeamMember,
        models::team_member::UpdateTeamMember,
        models::work_item::WorkItem,
        models::work_item::CreateWorkItem,
        models::work_item::UpdateWorkItem,
    )),
    tags(
        (name = "epics", description = "Epic management"),
        (name = "team-members", description = "Team member management"),
        (name = "work-items", description = "Work item management"),
    )
)]
struct ApiDoc;

pub fn create_app(pool: PgPool) -> Router {
    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .nest("/api", api_router(pool))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
}

fn api_router(pool: PgPool) -> Router {
    Router::new()
        .route(
            "/epics",
            get(handlers::epics::list_epics).post(handlers::epics::create_epic),
        )
        .route(
            "/epics/:id",
            get(handlers::epics::get_epic)
                .put(handlers::epics::update_epic)
                .delete(handlers::epics::delete_epic),
        )
        .route(
            "/team-members",
            get(handlers::team_members::list_team_members)
                .post(handlers::team_members::create_team_member),
        )
        .route(
            "/team-members/:id",
            get(handlers::team_members::get_team_member)
                .put(handlers::team_members::update_team_member)
                .delete(handlers::team_members::delete_team_member),
        )
        .route(
            "/work-items",
            get(handlers::work_items::list_work_items)
                .post(handlers::work_items::create_work_item),
        )
        .route(
            "/work-items/:id",
            get(handlers::work_items::get_work_item)
                .put(handlers::work_items::update_work_item)
                .delete(handlers::work_items::delete_work_item),
        )
        .with_state(pool)
}
