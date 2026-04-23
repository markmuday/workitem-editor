use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::team_member::{CreateTeamMember, TeamMember, UpdateTeamMember};

#[utoipa::path(
    get,
    path = "/api/team-members",
    responses(
        (status = 200, description = "List of team members", body = Vec<TeamMember>)
    ),
    tag = "team-members"
)]
pub async fn list_team_members(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<TeamMember>>, AppError> {
    let members = sqlx::query_as::<_, TeamMember>(
        "SELECT id, name, created_at, updated_at, last_epic_id FROM team_member ORDER BY name ASC NULLS LAST",
    )
    .fetch_all(&pool)
    .await?;
    Ok(Json(members))
}

#[utoipa::path(
    post,
    path = "/api/team-members",
    request_body = CreateTeamMember,
    responses(
        (status = 201, description = "Team member created", body = TeamMember)
    ),
    tag = "team-members"
)]
pub async fn create_team_member(
    State(pool): State<PgPool>,
    Json(body): Json<CreateTeamMember>,
) -> Result<(StatusCode, Json<TeamMember>), AppError> {
    let member = sqlx::query_as::<_, TeamMember>(
        "INSERT INTO team_member (name, last_epic_id)
         VALUES ($1, $2)
         RETURNING id, name, created_at, updated_at, last_epic_id",
    )
    .bind(body.name)
    .bind(body.last_epic_id)
    .fetch_one(&pool)
    .await?;
    Ok((StatusCode::CREATED, Json(member)))
}

#[utoipa::path(
    get,
    path = "/api/team-members/{id}",
    params(("id" = Uuid, Path, description = "Team member ID")),
    responses(
        (status = 200, description = "Team member found", body = TeamMember),
        (status = 404, description = "Team member not found")
    ),
    tag = "team-members"
)]
pub async fn get_team_member(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<TeamMember>, AppError> {
    let member = sqlx::query_as::<_, TeamMember>(
        "SELECT id, name, created_at, updated_at, last_epic_id FROM team_member WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&pool)
    .await?;
    Ok(Json(member))
}

#[utoipa::path(
    put,
    path = "/api/team-members/{id}",
    params(("id" = Uuid, Path, description = "Team member ID")),
    request_body = UpdateTeamMember,
    responses(
        (status = 200, description = "Team member updated", body = TeamMember),
        (status = 404, description = "Team member not found")
    ),
    tag = "team-members"
)]
pub async fn update_team_member(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTeamMember>,
) -> Result<Json<TeamMember>, AppError> {
    let member = sqlx::query_as::<_, TeamMember>(
        "UPDATE team_member
         SET name = $1, last_epic_id = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, name, created_at, updated_at, last_epic_id",
    )
    .bind(body.name)
    .bind(body.last_epic_id)
    .bind(id)
    .fetch_one(&pool)
    .await?;
    Ok(Json(member))
}

#[utoipa::path(
    delete,
    path = "/api/team-members/{id}",
    params(("id" = Uuid, Path, description = "Team member ID")),
    responses(
        (status = 204, description = "Team member deleted"),
        (status = 404, description = "Team member not found")
    ),
    tag = "team-members"
)]
pub async fn delete_team_member(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM team_member WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}
