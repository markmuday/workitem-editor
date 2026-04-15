use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use work_item_editor_api::create_app;

// ── helpers ──────────────────────────────────────────────────────────────────

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

// ── tests ─────────────────────────────────────────────────────────────────────

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn list_returns_empty_initially(pool: PgPool) {
    let res = create_app(pool).oneshot(get("/api/epics")).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(body_json(res).await, json!([]));
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn create_returns_201_with_body(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(post_json("/api/epics", json!({ "name": "Sprint 1" })))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = body_json(res).await;
    assert_eq!(body["name"], "Sprint 1");
    assert!(body["id"].is_string());
    assert!(!body["created_at"].is_null());
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn create_with_null_name(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(post_json("/api/epics", json!({})))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = body_json(res).await;
    assert!(body["name"].is_null());
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn get_returns_created_record(pool: PgPool) {
    let app = create_app(pool);

    let created = body_json(
        app.clone().oneshot(post_json("/api/epics", json!({ "name": "My Epic" }))).await.unwrap(),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    let res = app.oneshot(get(&format!("/api/epics/{id}"))).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    assert_eq!(body["id"], created["id"]);
    assert_eq!(body["name"], "My Epic");
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn get_returns_404_for_unknown_id(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(get("/api/epics/00000000-0000-0000-0000-000000000000"))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn list_returns_all_epics(pool: PgPool) {
    let app = create_app(pool);
    for name in ["Alpha", "Beta", "Gamma"] {
        app.clone()
            .oneshot(post_json("/api/epics", json!({ "name": name })))
            .await
            .unwrap();
    }
    let res = app.oneshot(get("/api/epics")).await.unwrap();
    let body = body_json(res).await;
    assert_eq!(body.as_array().unwrap().len(), 3);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn update_changes_name(pool: PgPool) {
    let app = create_app(pool);

    let created = body_json(
        app.clone().oneshot(post_json("/api/epics", json!({ "name": "Old" }))).await.unwrap(),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    let res = app
        .clone()
        .oneshot(put_json(&format!("/api/epics/{id}"), json!({ "name": "New" })))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = body_json(res).await;
    assert_eq!(body["name"], "New");
    assert_eq!(body["id"], created["id"]);
    assert!(!body["modified_at"].is_null());
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn update_returns_404_for_unknown_id(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(put_json(
            "/api/epics/00000000-0000-0000-0000-000000000000",
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
        app.clone().oneshot(post_json("/api/epics", json!({ "name": "Gone" }))).await.unwrap(),
    )
    .await;
    let id = created["id"].as_str().unwrap();

    let del = app.clone().oneshot(delete(&format!("/api/epics/{id}"))).await.unwrap();
    assert_eq!(del.status(), StatusCode::NO_CONTENT);

    let get_res = app.oneshot(get(&format!("/api/epics/{id}"))).await.unwrap();
    assert_eq!(get_res.status(), StatusCode::NOT_FOUND);
}

#[sqlx::test(migrator = "work_item_editor_api::MIGRATOR")]
async fn delete_returns_404_for_unknown_id(pool: PgPool) {
    let res = create_app(pool)
        .oneshot(delete("/api/epics/00000000-0000-0000-0000-000000000000"))
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
