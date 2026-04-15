use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use work_item_editor_api::create_app;

// ── helpers ───────────────────────────────────────────────────────────────────

async fn body_json(res: axum::response::Response) -> Value {
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

fn get(uri: &str) -> Request<Body> {
    Request::builder().uri(uri).body(Body::empty()).unwrap()
}

fn post_json(uri: &str, body: Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

fn put_json(uri: &str, body: Value) -> Request<Body> {
    Request::builder()
        .method("PUT")
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

fn delete(uri: &str) -> Request<Body> {
    Request::builder().method("DELETE").uri(uri).body(Body::empty()).unwrap()
}

async fn create_epic(app: axum::Router, name: &str) -> Value {
    body_json(
        app.oneshot(post_json("/api/epics", json!({ "name": name }))).await.unwrap(),
    )
    .await
}

async fn create_member(app: axum::Router, name: &str) -> Value {
    body_json(
        app.oneshot(post_json("/api/team-members", json!({ "name": name }))).await.unwrap(),
    )
    .await
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn list_returns_empty_initially(pool: PgPool) {
    let res = create_app(pool).oneshot(get("/api/work-items")).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(body_json(res).await, json!([]));
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn create_returns_201_with_body(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(post_json(
            "/api/work-items",
            json!({ "description": "Write tests", "percent_of_day": 25 }),
        ))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = body_json(res).await;
    assert_eq!(body["description"], "Write tests");
    assert_eq!(body["percent_of_day"], 25);
    assert!(body["id"].is_string());
    assert!(body["team_member_id"].is_null());
    assert!(body["epic_id"].is_null());
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn create_with_all_fields(pool: PgPool) {
    let app = create_app(pool);
    let epic = create_epic(app.clone(), "Q1").await;
    let member = create_member(app.clone(), "Alice").await;
    let epic_id = epic["id"].as_str().unwrap();
    let member_id = member["id"].as_str().unwrap();

    let res = app
        .oneshot(post_json(
            "/api/work-items",
            json!({
                "description": "Implement feature",
                "team_member_id": member_id,
                "epic_id": epic_id,
                "percent_of_day": 50
            }),
        ))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = body_json(res).await;
    assert_eq!(body["description"], "Implement feature");
    assert_eq!(body["epic_id"], epic_id);
    assert_eq!(body["team_member_id"], member_id);
    assert_eq!(body["percent_of_day"], 50);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn create_with_no_fields(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(post_json("/api/work-items", json!({})))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = body_json(res).await;
    assert!(body["description"].is_null());
    assert!(body["percent_of_day"].is_null());
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn get_returns_created_record(pool: PgPool) {
    let app = create_app(pool);
    let created = body_json(
        app.clone()
            .oneshot(post_json("/api/work-items", json!({ "description": "My task" })))
            .await
            .unwrap(),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    let res = app.oneshot(get(&format!("/api/work-items/{id}"))).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    assert_eq!(body["id"], created["id"]);
    assert_eq!(body["description"], "My task");
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn get_returns_404_for_unknown_id(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(get("/api/work-items/00000000-0000-0000-0000-000000000000"))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn list_returns_all_items(pool: PgPool) {
    let app = create_app(pool);
    for desc in ["Task A", "Task B", "Task C"] {
        app.clone()
            .oneshot(post_json("/api/work-items", json!({ "description": desc })))
            .await
            .unwrap();
    }
    let res = app.oneshot(get("/api/work-items")).await.unwrap();
    let body = body_json(res).await;
    assert_eq!(body.as_array().unwrap().len(), 3);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn update_changes_fields(pool: PgPool) {
    let app = create_app(pool);
    let created = body_json(
        app.clone()
            .oneshot(post_json(
                "/api/work-items",
                json!({ "description": "Original", "percent_of_day": 10 }),
            ))
            .await
            .unwrap(),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    let res = app
        .clone()
        .oneshot(put_json(
            &format!("/api/work-items/{id}"),
            json!({ "description": "Updated", "percent_of_day": 75 }),
        ))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    assert_eq!(body["description"], "Updated");
    assert_eq!(body["percent_of_day"], 75);
    assert!(!body["updated_at"].is_null());
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn update_assigns_epic_and_member(pool: PgPool) {
    let app = create_app(pool);
    let epic = create_epic(app.clone(), "Epic").await;
    let member = create_member(app.clone(), "Bob").await;
    let epic_id = epic["id"].as_str().unwrap();
    let member_id = member["id"].as_str().unwrap();

    let created = body_json(
        app.clone()
            .oneshot(post_json("/api/work-items", json!({ "description": "Orphan task" })))
            .await
            .unwrap(),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    let res = app
        .clone()
        .oneshot(put_json(
            &format!("/api/work-items/{id}"),
            json!({ "epic_id": epic_id, "team_member_id": member_id }),
        ))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    assert_eq!(body["epic_id"], epic_id);
    assert_eq!(body["team_member_id"], member_id);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn update_returns_404_for_unknown_id(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(put_json(
            "/api/work-items/00000000-0000-0000-0000-000000000000",
            json!({ "description": "X" }),
        ))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn delete_removes_record(pool: PgPool) {
    let app = create_app(pool);
    let created = body_json(
        app.clone()
            .oneshot(post_json("/api/work-items", json!({ "description": "To delete" })))
            .await
            .unwrap(),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    let del = app.clone().oneshot(delete(&format!("/api/work-items/{id}"))).await.unwrap();
    assert_eq!(del.status(), StatusCode::NO_CONTENT);

    let get_res = app.oneshot(get(&format!("/api/work-items/{id}"))).await.unwrap();
    assert_eq!(get_res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn delete_returns_404_for_unknown_id(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(delete("/api/work-items/00000000-0000-0000-0000-000000000000"))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
