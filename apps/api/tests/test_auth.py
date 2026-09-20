def test_register_creates_user_and_workspace(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "new@leadforge.dev",
            "password": "correct-horse-battery",
            "full_name": "New User",
            "workspace_name": "New Studio",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "new@leadforge.dev"
    assert body["workspace"]["name"] == "New Studio"
    assert body["access_token"]


def test_register_rejects_duplicate_email(client):
    payload = {
        "email": "dup@leadforge.dev",
        "password": "correct-horse-battery",
        "full_name": "Dup",
        "workspace_name": "Dup Studio",
    }
    first = client.post("/api/auth/register", json=payload)
    assert first.status_code == 201
    second = client.post("/api/auth/register", json=payload)
    assert second.status_code == 409


def test_login_succeeds_with_correct_password(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "login@leadforge.dev",
            "password": "correct-horse-battery",
            "full_name": "Login Test",
            "workspace_name": "Login Studio",
        },
    )
    response = client.post(
        "/api/auth/login", json={"email": "login@leadforge.dev", "password": "correct-horse-battery"}
    )
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_fails_with_wrong_password(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "wrongpw@leadforge.dev",
            "password": "correct-horse-battery",
            "full_name": "Test",
            "workspace_name": "Studio",
        },
    )
    response = client.post("/api/auth/login", json={"email": "wrongpw@leadforge.dev", "password": "nope"})
    assert response.status_code == 401


def test_token_grants_access_to_own_workspace_only(client):
    register = client.post(
        "/api/auth/register",
        json={
            "email": "isolated@leadforge.dev",
            "password": "correct-horse-battery",
            "full_name": "Isolated",
            "workspace_name": "Isolated Studio",
        },
    )
    token = register.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "isolated@leadforge.dev"
    assert len(me.json()["workspaces"]) == 1

    leads = client.get("/api/leads", headers={"Authorization": f"Bearer {token}"})
    assert leads.status_code == 200
    assert leads.json() == []


def test_invalid_token_is_rejected(client):
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


def test_no_credentials_falls_back_to_dev_default_user(client, demo_workspace):
    # X-User-Email/demo default only resolves to a *real* row that must
    # already exist — it can never impersonate an arbitrary account.
    response = client.get("/api/leads")
    assert response.status_code == 200


def test_register_sets_auth_cookie(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "cookie-test@leadforge.dev",
            "password": "correct-horse-battery",
            "full_name": "Cookie",
            "workspace_name": "Cookie Studio",
        },
    )
    assert response.status_code == 201
    cookies = {c.name: c.value for c in client.cookies.jar}
    assert "lf_token" in cookies
    assert len(cookies["lf_token"]) > 20


def test_login_sets_auth_cookie(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "cookielogin@leadforge.dev",
            "password": "correct-horse-battery",
            "full_name": "CL",
            "workspace_name": "CL Studio",
        },
    )
    response = client.post(
        "/api/auth/login",
        json={"email": "cookielogin@leadforge.dev", "password": "correct-horse-battery"},
    )
    assert response.status_code == 200
    cookies = {c.name: c.value for c in client.cookies.jar}
    assert "lf_token" in cookies


def test_cookie_auth_works_without_authorization_header(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "cookieauth@leadforge.dev",
            "password": "correct-horse-battery",
            "full_name": "CA",
            "workspace_name": "CA Studio",
        },
    )
    # The TestClient stores the cookie from register — next request uses it.
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "cookieauth@leadforge.dev"


def test_logout_clears_auth_cookie(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "logouttest@leadforge.dev",
            "password": "correct-horse-battery",
            "full_name": "LT",
            "workspace_name": "LT Studio",
        },
    )
    assert "lf_token" in {c.name: c.value for c in client.cookies.jar}

    response = client.post("/api/auth/logout")
    assert response.status_code == 204
    cookies = {c.name: c.value for c in client.cookies.jar}
    assert "lf_token" not in cookies
