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
    assert register.json()["user"]["subscription_status"] == "inactive"

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
    first_avatar_url = uploaded.json()["avatar_url"]
    assert first_avatar_url.startswith("/media/avatars/")
    assert uploaded.json()["avatar_preset"] is None

    uploaded_again = client.post(
        "/auth/me/avatar",
        headers=auth_headers,
        files={"file": ("avatar.png", b"updated-image-content", "image/png")},
    )
    assert uploaded_again.status_code == 200
    assert uploaded_again.json()["avatar_url"].startswith("/media/avatars/")
    assert uploaded_again.json()["avatar_url"] != first_avatar_url

    logout = client.post("/auth/logout", headers=auth_headers)
    assert logout.status_code == 200

    delete = client.delete("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert delete.status_code == 401


def test_subscription_activation_unlocks_core_routes(test_context):
    client = test_context["client"]
    register = client.post(
        "/auth/register",
        json={"email": "locked@example.com", "username": "lockeduser", "password": "password123"},
    )
    assert register.status_code == 200
    auth_headers = {"Authorization": f"Bearer {register.json()['token']}"}

    me = client.get("/auth/me", headers=auth_headers)
    assert me.status_code == 200
    assert me.json()["subscription_status"] == "inactive"

    locked_dashboard = client.get("/dashboard/summary", headers=auth_headers)
    assert locked_dashboard.status_code == 402
    assert locked_dashboard.json()["detail"] == "Subscription required"

    activated = client.post("/auth/me/subscription", headers=auth_headers)
    assert activated.status_code == 200
    assert activated.json()["subscription_status"] == "active"
    assert activated.json()["subscription_plan"] == "pro"

    unlocked_dashboard = client.get("/dashboard/summary", headers=auth_headers)
    assert unlocked_dashboard.status_code == 200


def test_deactivated_user_cannot_login_or_use_existing_session(test_context):
    client = test_context["client"]
    db = test_context["db"]

    db["users"].docs[0]["is_active"] = False

    login = client.post("/auth/login", json={"email": "tester@example.com", "password": "password123"})
    assert login.status_code == 403
    assert login.json()["detail"] == "Account deactivated"

    me = client.get("/auth/me", headers=test_context["headers"])
    assert me.status_code == 401
    assert me.json()["detail"] == "Account deactivated"
    assert db["sessions"].docs == []


def test_password_change_verifies_current_password_and_rotates_session(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    wrong = client.post(
        "/auth/me/password",
        headers=headers,
        json={"current_password": "wrongpass123", "new_password": "newpassword123"},
    )
    assert wrong.status_code == 401
    assert wrong.json()["detail"] == "Current password is incorrect"

    changed = client.post(
        "/auth/me/password",
        headers=headers,
        json={"current_password": "password123", "new_password": "newpassword123"},
    )
    assert changed.status_code == 200
    changed_payload = changed.json()
    assert changed_payload["token"]
    assert changed_payload["user"]["email"] == "tester@example.com"

    stale_me = client.get("/auth/me", headers=headers)
    assert stale_me.status_code == 401

    new_headers = {"Authorization": f"Bearer {changed_payload['token']}"}
    fresh_me = client.get("/auth/me", headers=new_headers)
    assert fresh_me.status_code == 200

    old_login = client.post("/auth/login", json={"email": "tester@example.com", "password": "password123"})
    assert old_login.status_code == 401

    new_login = client.post("/auth/login", json={"email": "tester@example.com", "password": "newpassword123"})
    assert new_login.status_code == 200
