"""Focused tests for database indexes, confirmation uniqueness, resume defaults, and progress keys."""

from __future__ import annotations

import asyncio
from datetime import timedelta

from bson import ObjectId

from app.core.auth import now_utc
from app.core.config import settings
from app.core.db import _normalize_local_mongo_uri, close_mongo_connection, connect_to_mongo
from app.routers.confirmations import confirmation_scope_key
from app.main import ensure_indexes, normalize_learning_path_progress_records
from app.routers.taxonomy import _progress_skill_key


class _RecordingCollection:
    def __init__(self, name: str, calls: list[dict]):
        self.name = name
        self.calls = calls

    async def create_index(self, *args, **kwargs):
        self.calls.append({"collection": self.name, "args": args, "kwargs": kwargs})
        return None


class _RecordingDatabase:
    def __init__(self):
        self.calls: list[dict] = []
        self._collections: dict[str, _RecordingCollection] = {}

    def __getitem__(self, name: str) -> _RecordingCollection:
        if name not in self._collections:
            self._collections[name] = _RecordingCollection(name, self.calls)
        return self._collections[name]


def test_startup_indexes_cover_username_confirmations_and_normalized_progress_keys(monkeypatch):
    db = _RecordingDatabase()
    monkeypatch.setattr("app.main.get_db", lambda: db)

    asyncio.run(ensure_indexes())

    assert any(
        call["collection"] == "users" and call["args"] == ("username",) and call["kwargs"] == {"unique": True}
        for call in db.calls
    )
    assert any(
        call["collection"] == "resume_skill_confirmations"
        and call["args"] == ([("user_id", 1), ("scope_key", 1)],)
        and call["kwargs"] == {"unique": True}
        for call in db.calls
    )
    assert any(
        call["collection"] == "learning_path_progress"
        and call["args"] == ([("user_id", 1), ("skill_key", 1)],)
        and call["kwargs"] == {
            "unique": True,
            "partialFilterExpression": {"skill_key": {"$type": "string"}},
        }
        for call in db.calls
    )


def test_mongo_connection_logging_redacts_full_uri(monkeypatch, caplog):
    class _DummyAdmin:
        async def command(self, name: str):
            assert name == "ping"
            return {"ok": 1}

    class _DummyClient:
        def __init__(self, uri: str, **kwargs):
            self.uri = uri
            self.kwargs = kwargs
            self.admin = _DummyAdmin()

        def close(self):
            return None

    monkeypatch.setattr("app.core.db.AsyncIOMotorClient", _DummyClient)
    monkeypatch.setattr(settings, "mongo_uri", "mongodb://example.invalid:27017/secret-db")
    monkeypatch.setattr(settings, "mongo_db", "skillbridge_test")
    caplog.set_level("INFO", logger="app.core.db")

    asyncio.run(connect_to_mongo())
    asyncio.run(close_mongo_connection())

    assert settings.mongo_uri not in caplog.text
    assert "skillbridge_test" in caplog.text


def test_mongo_uri_normalizes_localhost_to_ipv4_loopback():
    assert _normalize_local_mongo_uri("mongodb://localhost:27017") == "mongodb://127.0.0.1:27017"
    assert _normalize_local_mongo_uri("mongodb://user:pass@localhost:27017/?authSource=admin") == (
        "mongodb://user:pass@127.0.0.1:27017/?authSource=admin"
    )
    assert _normalize_local_mongo_uri("mongodb://mongo.internal:27017") == "mongodb://mongo.internal:27017"


def test_profile_confirmation_upsert_stays_single_document(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    db = test_context["db"]
    user_oid = ObjectId(test_context["user_id"])

    first = client.post(
        "/skills/confirmations/",
        headers=headers,
        json={
            "resume_snapshot_id": None,
            "confirmed": [{"skill_id": test_context["skill_python"], "proficiency": 2}],
            "rejected": [],
            "edited": [],
        },
    )
    second = client.post(
        "/skills/confirmations/",
        headers=headers,
        json={
            "resume_snapshot_id": None,
            "confirmed": [{"skill_id": test_context["skill_python"], "proficiency": 5}],
            "rejected": [],
            "edited": [],
        },
    )

    assert first.status_code == 200
    assert second.status_code == 200
    profile_docs = [
        doc
        for doc in db["resume_skill_confirmations"].docs
        if doc.get("user_id") == user_oid and doc.get("scope_key") == confirmation_scope_key(None)
    ]
    assert len(profile_docs) == 1
    assert profile_docs[0]["confirmed"][0]["skill_id"] == ObjectId(test_context["skill_python"])


def test_resume_confirmation_upsert_stays_single_document_per_snapshot(test_context, monkeypatch):
    client = test_context["client"]
    headers = test_context["headers"]
    db = test_context["db"]
    user_oid = ObjectId(test_context["user_id"])

    async def _noop_sync_rag_document(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.routers.resumes.sync_rag_document", _noop_sync_rag_document)

    snapshot = client.post(
        "/ingest/resume/text",
        headers=headers,
        json={"text": "Python ML FastAPI dashboards with production APIs."},
    )
    assert snapshot.status_code == 200
    snapshot_id = snapshot.json()["snapshot_id"]

    first = client.post(
        "/skills/confirmations/",
        headers=headers,
        json={
            "resume_snapshot_id": snapshot_id,
            "confirmed": [{"skill_id": test_context["skill_python"], "proficiency": 3}],
            "rejected": [],
            "edited": [],
        },
    )
    second = client.post(
        "/skills/confirmations/",
        headers=headers,
        json={
            "resume_snapshot_id": snapshot_id,
            "confirmed": [{"skill_id": test_context["skill_python"], "proficiency": 4}],
            "rejected": [],
            "edited": [],
        },
    )

    assert first.status_code == 200
    assert second.status_code == 200
    snapshot_docs = [
        doc
        for doc in db["resume_skill_confirmations"].docs
        if doc.get("user_id") == user_oid and doc.get("scope_key") == confirmation_scope_key(ObjectId(snapshot_id))
    ]
    assert len(snapshot_docs) == 1
    assert snapshot_docs[0]["confirmed"][0]["skill_id"] == ObjectId(test_context["skill_python"])


def test_resume_text_ingest_uses_authenticated_user_when_user_id_is_omitted(test_context, monkeypatch):
    client = test_context["client"]
    headers = test_context["headers"]
    db = test_context["db"]
    user_oid = ObjectId(test_context["user_id"])

    async def _noop_sync_rag_document(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.routers.resumes.sync_rag_document", _noop_sync_rag_document)

    response = client.post(
        "/ingest/resume/text",
        headers=headers,
        json={"text": "Python ML FastAPI dashboards with production APIs."},
    )

    assert response.status_code == 200
    snapshot_id = response.json()["snapshot_id"]
    stored = next(doc for doc in db["resume_snapshots"].docs if str(doc.get("_id")) == snapshot_id)
    assert stored["user_id"] == user_oid


def test_learning_path_progress_list_dedupes_normalized_skill_keys(test_context):
    client = test_context["client"]
    headers = test_context["headers"]
    db = test_context["db"]
    user_oid = ObjectId(test_context["user_id"])
    normalized_key = _progress_skill_key("Machine Learning")

    db["learning_path_progress"].docs = [
        {
            "_id": ObjectId(),
            "user_id": user_oid,
            "skill_name": "Machine Learning",
            "skill_key": normalized_key,
            "status": "in_progress",
            "updated_at": now_utc(),
        },
        {
            "_id": ObjectId(),
            "user_id": user_oid,
            "skill_name": "ML",
            "skill_key": normalized_key,
            "status": "completed",
            "updated_at": now_utc() + timedelta(seconds=1),
        },
    ]

    response = client.get("/taxonomy/learning-path/progress", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["status"] == "completed"


def test_normalize_learning_path_progress_records_repairs_null_keys_and_dedupes(monkeypatch):
    class _ProgressCollection:
        def __init__(self):
            self.docs = [
                {
                    "_id": 1,
                    "user_id": ObjectId("69a46a36607c51e7c90e19ab"),
                    "skill_name": "Machine Learning",
                    "skill_key": None,
                    "status": "in_progress",
                    "created_at": now_utc(),
                    "updated_at": now_utc(),
                },
                {
                    "_id": 2,
                    "user_id": ObjectId("69a46a36607c51e7c90e19ab"),
                    "skill_name": "Machine Learning",
                    "skill_key": None,
                    "status": "completed",
                    "created_at": now_utc(),
                    "updated_at": now_utc() + timedelta(seconds=1),
                },
                {
                    "_id": 3,
                    "user_id": ObjectId(),
                    "skill_name": "",
                    "skill_key": None,
                    "status": "not_started",
                    "created_at": now_utc(),
                    "updated_at": now_utc(),
                },
            ]

        def find(self, *_args, **_kwargs):
            class _Cursor:
                def __init__(self, docs):
                    self.docs = docs

                async def to_list(self, length=5000):
                    return list(self.docs)[:length]

            return _Cursor(self.docs)

        async def update_one(self, query, update):
            for doc in self.docs:
                if doc.get("_id") == query.get("_id"):
                    doc.update(update.get("$set", {}))
                    return None
            return None

        async def delete_many(self, query):
            ids = set((query.get("_id") or {}).get("$in") or [])
            self.docs = [doc for doc in self.docs if doc.get("_id") not in ids]
            return None

    class _Db:
        def __init__(self):
            self.collection = _ProgressCollection()

        def __getitem__(self, name):
            assert name == "learning_path_progress"
            return self.collection

    db = _Db()
    monkeypatch.setattr("app.main.get_db", lambda: db)

    asyncio.run(normalize_learning_path_progress_records())

    assert len(db.collection.docs) == 1
    assert db.collection.docs[0]["_id"] == 2
    assert db.collection.docs[0]["skill_key"] == _progress_skill_key("Machine Learning")
