import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_INTEGRATION_TESTS", "0") != "1",
    reason="Set RUN_INTEGRATION_TESTS=1 to run Mongo-backed integration tests.",
)

client = TestClient(app)

def test_register_login_me_flow():
    # Use a unique email each run
    import uuid
    email = f"pytest_{uuid.uuid4().hex[:8]}@skillbridge.local"
    pw = "PytestPass123!"
    r = client.post("/auth/register", json={"email": email, "username": "pytest", "password": pw})
    assert r.status_code in (200, 201), r.text
    token = r.json()["token"]
    assert token

    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["email"] == email.lower()

    # Update username
    r = client.patch("/auth/me", json={"username": "pytest2"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    assert r.json()["username"] == "pytest2"

    # Logout should invalidate (we delete sessions for user)
    r = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
