"""Smoke tests covering authentication flows and health endpoints."""

def test_health_endpoints(test_context):
    client = test_context["client"]
    assert client.get("/health/").status_code == 200
    counts = client.get("/health/db_counts").json()
    assert counts["skills"] >= 2


def test_auth_register_login_profile_and_logout(test_context):
    client = test_context["client"]
    register = client.post(
        "/auth/register",
        json={"email": "newuser@example.com", "username": "newuser", "password": "password123"},
    )
    assert register.status_code == 200
    token = register.json()["token"]

    login = client.post("/auth/login", json={"email": "newuser@example.com", "password": "password123"})
    assert login.status_code == 200
    auth_headers = {"Authorization": f"Bearer {login.json()['token']}"}

    me = client.get("/auth/me", headers=auth_headers)
    assert me.status_code == 200
    assert me.json()["username"] == "newuser"

    patch = client.patch("/auth/me", headers=auth_headers, json={"username": "renamed"})
    assert patch.status_code == 200
    assert patch.json()["username"] == "renamed"

    preset = client.patch("/auth/me", headers=auth_headers, json={"avatar_preset": "ember"})
    assert preset.status_code == 200
    assert preset.json()["avatar_preset"] == "ember"
    assert preset.json()["avatar_url"] is None

    uploaded = client.post(
        "/auth/me/avatar",
        headers=auth_headers,
        files={"file": ("avatar.png", b"fake-image-content", "image/png")},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["avatar_url"].startswith("/media/avatars/")
    assert uploaded.json()["avatar_preset"] is None

    logout = client.post("/auth/logout", headers=auth_headers)
    assert logout.status_code == 200

    delete = client.delete("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert delete.status_code == 401
