use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::epic::{CreateEpic, Epic, UpdateEpic};

#[utoipa::path(
    get,
    path = "/api/epics",
    responses(
        (status = 200, description = "List of epics", body = Vec<Epic>)
    ),
    tag = "epics"
)]
pub async fn list_epics(State(pool): State<PgPool>) -> Result<Json<Vec<Epic>>, AppError> {
    let epics = sqlx::query_as::<_, Epic>(
        "SELECT id, name, created_at, modified_at FROM epic ORDER BY created_at DESC NULLS LAST",
    )
    .fetch_all(&pool)
    .await?;
    Ok(Json(epics))
}

#[utoipa::path(
    post,
    path = "/api/epics",
    request_body = CreateEpic,
    responses(
        (status = 201, description = "Epic created", body = Epic)
    ),
    tag = "epics"
)]
pub async fn create_epic(
    State(pool): State<PgPool>,
    Json(body): Json<CreateEpic>,
) -> Result<(StatusCode, Json<Epic>), AppError> {
    let epic = sqlx::query_as::<_, Epic>(
        "INSERT INTO epic (name, created_at, modified_at)
         VALUES ($1, NOW(), NOW())
         RETURNING id, name, created_at, modified_at",
    )
    .bind(body.name)
    .fetch_one(&pool)
    .await?;
    Ok((StatusCode::CREATED, Json(epic)))
}

#[utoipa::path(
    get,
    path = "/api/epics/{id}",
    params(("id" = Uuid, Path, description = "Epic ID")),
    responses(
        (status = 200, description = "Epic found", body = Epic),
        (status = 404, description = "Epic not found")
    ),
    tag = "epics"
)]
pub async fn get_epic(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Epic>, AppError> {
    let epic = sqlx::query_as::<_, Epic>(
        "SELECT id, name, created_at, modified_at FROM epic WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&pool)
    .await?;
    Ok(Json(epic))
}

#[utoipa::path(
    put,
    path = "/api/epics/{id}",
    params(("id" = Uuid, Path, description = "Epic ID")),
    request_body = UpdateEpic,
    responses(
        (status = 200, description = "Epic updated", body = Epic),
        (status = 404, description = "Epic not found")
    ),
    tag = "epics"
)]
pub async fn update_epic(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateEpic>,
) -> Result<Json<Epic>, AppError> {
    let epic = sqlx::query_as::<_, Epic>(
        "UPDATE epic
         SET name = $1, modified_at = NOW()
         WHERE id = $2
         RETURNING id, name, created_at, modified_at",
    )
    .bind(body.name)
    .bind(id)
    .fetch_one(&pool)
    .await?;
    Ok(Json(epic))
}

#[utoipa::path(
    delete,
    path = "/api/epics/{id}",
    params(("id" = Uuid, Path, description = "Epic ID")),
    responses(
        (status = 204, description = "Epic deleted"),
        (status = 404, description = "Epic not found")
    ),
    tag = "epics"
)]
pub async fn delete_epic(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM epic WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}
