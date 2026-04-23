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

// ── tests ─────────────────────────────────────────────────────────────────────

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn list_returns_empty_initially(pool: PgPool) {
    let res = create_app(pool).oneshot(get("/api/team-members")).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(body_json(res).await, json!([]));
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn create_returns_201_with_body(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(post_json("/api/team-members", json!({ "name": "Alice" })))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = body_json(res).await;
    assert_eq!(body["name"], "Alice");
    assert!(body["id"].is_string());
    assert!(body["last_epic_id"].is_null());
    assert!(!body["created_at"].is_null());
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn create_with_last_epic_id(pool: PgPool) {
    let app = create_app(pool);
    let epic = create_epic(app.clone(), "Q1").await;
    let epic_id = epic["id"].as_str().unwrap();

    let res = app
        .oneshot(post_json("/api/team-members", json!({ "name": "Bob", "last_epic_id": epic_id })))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = body_json(res).await;
    assert_eq!(body["last_epic_id"], epic_id);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn get_returns_created_record(pool: PgPool) {
    let app = create_app(pool);
    let created = body_json(
        app.clone()
            .oneshot(post_json("/api/team-members", json!({ "name": "Carol" })))
            .await
            .unwrap(),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    let res = app.oneshot(get(&format!("/api/team-members/{id}"))).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    assert_eq!(body["id"], created["id"]);
    assert_eq!(body["name"], "Carol");
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn get_returns_404_for_unknown_id(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(get("/api/team-members/00000000-0000-0000-0000-000000000000"))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn list_returns_all_members(pool: PgPool) {
    let app = create_app(pool);
    for name in ["Carol", "Alice", "Bob"] {
        app.clone()
            .oneshot(post_json("/api/team-members", json!({ "name": name })))
            .await
            .unwrap();
    }
    let res = app.oneshot(get("/api/team-members")).await.unwrap();
    let body = body_json(res).await;
    let names: Vec<&str> = body.as_array().unwrap().iter()
        .map(|m| m["name"].as_str().unwrap())
        .collect();
    assert_eq!(names, ["Alice", "Bob", "Carol"]);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn update_changes_name(pool: PgPool) {
    let app = create_app(pool);
    let created = body_json(
        app.clone()
            .oneshot(post_json("/api/team-members", json!({ "name": "Old Name" })))
            .await
            .unwrap(),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    let res = app
        .clone()
        .oneshot(put_json(&format!("/api/team-members/{id}"), json!({ "name": "New Name" })))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    assert_eq!(body["name"], "New Name");
    assert!(!body["updated_at"].is_null());
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn update_sets_last_epic_id(pool: PgPool) {
    let app = create_app(pool);
    let epic = create_epic(app.clone(), "Epic").await;
    let epic_id = epic["id"].as_str().unwrap();

    let created = body_json(
        app.clone()
            .oneshot(post_json("/api/team-members", json!({ "name": "Dave" })))
            .await
            .unwrap(),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    let res = app
        .clone()
        .oneshot(put_json(
            &format!("/api/team-members/{id}"),
            json!({ "name": "Dave", "last_epic_id": epic_id }),
        ))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(body_json(res).await["last_epic_id"], epic_id);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn update_returns_404_for_unknown_id(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(put_json(
            "/api/team-members/00000000-0000-0000-0000-000000000000",
            json!({ "name": "X" }),
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
            .oneshot(post_json("/api/team-members", json!({ "name": "Eve" })))
            .await
            .unwrap(),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    let del = app.clone().oneshot(delete(&format!("/api/team-members/{id}"))).await.unwrap();
    assert_eq!(del.status(), StatusCode::NO_CONTENT);

    let get_res = app.oneshot(get(&format!("/api/team-members/{id}"))).await.unwrap();
    assert_eq!(get_res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn delete_returns_404_for_unknown_id(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(delete("/api/team-members/00000000-0000-0000-0000-000000000000"))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
