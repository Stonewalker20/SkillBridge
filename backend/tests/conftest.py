from __future__ import annotations

from pathlib import Path
import sys
from datetime import timedelta

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app
from app.core import db as core_db
from app.core.auth import hash_password, now_utc
from app.routers import evidence as evidence_router
from app.routers import tailor as tailor_router

from .fake_mongo import FakeDatabase, FakeMongoClient


def _fake_embed_texts(texts: list[str]):
    vectors = []
    for text in texts:
        lower = str(text or "").lower()
        vector = [
            1.0 if "python" in lower else 0.0,
            1.0 if "ml" in lower or "machine learning" in lower else 0.0,
            1.0 if "fastapi" in lower or "api" in lower else 0.0,
            1.0 if "dashboard" in lower or "analytics" in lower else 0.0,
        ]
        vectors.append(vector)
    return vectors, "test-embed"


async def _async_fake_embed_texts(texts: list[str]):
    return _fake_embed_texts(texts)


async def _async_fake_extract_skill_candidates(text: str, max_candidates: int = 25):
    lower = str(text or "").lower()
    candidates = []
    if "python" in lower:
        candidates.append({"name": "Python", "category": "Programming"})
    if "machine learning" in lower or "ml" in lower:
        candidates.append({"name": "ML", "category": "Data"})
    if "fastapi" in lower:
        candidates.append({"name": "FastAPI", "category": "Backend"})
    return candidates[:max_candidates], "test-transformer"


async def _async_fake_rewrite(job_text: str, bullets: list[str], focus: str):
    return [f"- Rewritten ({focus}): {bullet[2:] if bullet.startswith('- ') else bullet}" for bullet in bullets], "test-rewriter"


def _seed(fake_db: FakeDatabase):
    user_id = ObjectId()
    skill_python = ObjectId()
    skill_ml = ObjectId()
    role_id = ObjectId()
    session_id = ObjectId()
    password_parts = hash_password("password123")

    fake_db["users"].docs = [
        {
            "_id": user_id,
            "email": "tester@example.com",
            "username": "tester",
            "password_salt": password_parts["salt"],
            "password_hash": password_parts["hash"],
            "role": "user",
            "created_at": now_utc(),
        }
    ]
    fake_db["sessions"].docs = [
        {
            "_id": session_id,
            "user_id": user_id,
            "token": "test-token",
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(days=7),
        }
    ]
    fake_db["skills"].docs = [
        {
            "_id": skill_python,
            "name": "Python",
            "category": "Programming",
            "categories": ["Programming"],
            "aliases": ["Py"],
            "tags": ["language"],
            "origin": "default",
            "hidden": False,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        },
        {
            "_id": skill_ml,
            "name": "ML",
            "category": "Data",
            "categories": ["Data"],
            "aliases": ["Machine Learning"],
            "tags": ["ai"],
            "origin": "default",
            "hidden": False,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        },
    ]
    fake_db["roles"].docs = [
        {
            "_id": role_id,
            "name": "ML Engineer",
            "description": "Build ML systems",
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
    ]
    return {
        "user_id": str(user_id),
        "token": "test-token",
        "skill_python": str(skill_python),
        "skill_ml": str(skill_ml),
        "role_id": str(role_id),
    }


@pytest.fixture()
def test_context(monkeypatch):
    fake_db = FakeDatabase()
    seeded = _seed(fake_db)
    core_db._client = FakeMongoClient(fake_db)

    async def _noop():
        return None

    monkeypatch.setattr("app.main.connect_to_mongo", _noop)
    monkeypatch.setattr("app.main.close_mongo_connection", _noop)
    monkeypatch.setattr("app.main.ensure_indexes", _noop)
    monkeypatch.setattr("app.main.warm_local_models", _noop)
    monkeypatch.setattr(
        "app.main.get_inference_status",
        lambda: {
            "provider_mode": "test",
            "embeddings_provider": "test",
            "rewrite_provider": "test",
            "embedding_model": "fake-embed",
            "rewrite_model": "fake-rewriter",
        },
    )
    monkeypatch.setattr("app.main.settings.local_model_prewarm", False)
    monkeypatch.setattr(evidence_router, "extract_skill_candidates", _async_fake_extract_skill_candidates)
    monkeypatch.setattr(evidence_router, "embed_texts", _async_fake_embed_texts)
    monkeypatch.setattr(tailor_router, "embed_texts", _async_fake_embed_texts)
    monkeypatch.setattr(tailor_router, "rewrite_resume_bullets", _async_fake_rewrite)
    monkeypatch.setattr(
        tailor_router,
        "get_inference_status",
        lambda: {
            "provider_mode": "test",
            "embeddings_provider": "test",
            "rewrite_provider": "test",
            "embedding_model": "fake-embed",
            "rewrite_model": "fake-rewriter",
        },
    )

    with TestClient(app) as client:
        yield {
            "client": client,
            "db": fake_db,
            "headers": {"Authorization": f"Bearer {seeded['token']}"},
            **seeded,
        }

    core_db._client = None
