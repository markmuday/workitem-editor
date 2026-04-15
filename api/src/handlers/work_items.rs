use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::work_item::{CreateWorkItem, UpdateWorkItem, WorkItem};

#[utoipa::path(
    get,
    path = "/api/work-items",
    responses(
        (status = 200, description = "List of work items", body = Vec<WorkItem>)
    ),
    tag = "work-items"
)]
pub async fn list_work_items(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<WorkItem>>, AppError> {
    let items = sqlx::query_as::<_, WorkItem>(
        "SELECT id, description, team_member_id, epic_id, percent_of_day, created_at, updated_at
         FROM work_item ORDER BY created_at DESC NULLS LAST",
    )
    .fetch_all(&pool)
    .await?;
    Ok(Json(items))
}

#[utoipa::path(
    post,
    path = "/api/work-items",
    request_body = CreateWorkItem,
    responses(
        (status = 201, description = "Work item created", body = WorkItem)
    ),
    tag = "work-items"
)]
pub async fn create_work_item(
    State(pool): State<PgPool>,
    Json(body): Json<CreateWorkItem>,
) -> Result<(StatusCode, Json<WorkItem>), AppError> {
    let item = sqlx::query_as::<_, WorkItem>(
        "INSERT INTO work_item (description, team_member_id, epic_id, percent_of_day)
         VALUES ($1, $2, $3, $4)
         RETURNING id, description, team_member_id, epic_id, percent_of_day, created_at, updated_at",
    )
    .bind(body.description)
    .bind(body.team_member_id)
    .bind(body.epic_id)
    .bind(body.percent_of_day)
    .fetch_one(&pool)
    .await?;
    Ok((StatusCode::CREATED, Json(item)))
}

#[utoipa::path(
    get,
    path = "/api/work-items/{id}",
    params(("id" = Uuid, Path, description = "Work item ID")),
    responses(
        (status = 200, description = "Work item found", body = WorkItem),
        (status = 404, description = "Work item not found")
    ),
    tag = "work-items"
)]
pub async fn get_work_item(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<WorkItem>, AppError> {
    let item = sqlx::query_as::<_, WorkItem>(
        "SELECT id, description, team_member_id, epic_id, percent_of_day, created_at, updated_at
         FROM work_item WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&pool)
    .await?;
    Ok(Json(item))
}

#[utoipa::path(
    put,
    path = "/api/work-items/{id}",
    params(("id" = Uuid, Path, description = "Work item ID")),
    request_body = UpdateWorkItem,
    responses(
        (status = 200, description = "Work item updated", body = WorkItem),
        (status = 404, description = "Work item not found")
    ),
    tag = "work-items"
)]
pub async fn update_work_item(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateWorkItem>,
) -> Result<Json<WorkItem>, AppError> {
    let item = sqlx::query_as::<_, WorkItem>(
        "UPDATE work_item
         SET description = $1,
             team_member_id = $2,
             epic_id = $3,
             percent_of_day = $4,
             updated_at = NOW()
         WHERE id = $5
         RETURNING id, description, team_member_id, epic_id, percent_of_day, created_at, updated_at",
    )
    .bind(body.description)
    .bind(body.team_member_id)
    .bind(body.epic_id)
    .bind(body.percent_of_day)
    .bind(id)
    .fetch_one(&pool)
    .await?;
    Ok(Json(item))
}

#[utoipa::path(
    delete,
    path = "/api/work-items/{id}",
    params(("id" = Uuid, Path, description = "Work item ID")),
    responses(
        (status = 204, description = "Work item deleted"),
        (status = 404, description = "Work item not found")
    ),
    tag = "work-items"
)]
pub async fn delete_work_item(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM work_item WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}
