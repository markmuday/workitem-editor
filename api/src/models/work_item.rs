use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
pub struct WorkItem {
    pub id: Uuid,
    pub description: Option<String>,
    pub team_member_id: Option<Uuid>,
    pub epic_id: Option<Uuid>,
    pub percent_of_day: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateWorkItem {
    pub description: Option<String>,
    pub team_member_id: Option<Uuid>,
    pub epic_id: Option<Uuid>,
    pub percent_of_day: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateWorkItem {
    pub description: Option<String>,
    pub team_member_id: Option<Uuid>,
    pub epic_id: Option<Uuid>,
    pub percent_of_day: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
}
