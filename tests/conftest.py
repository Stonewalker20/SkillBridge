import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient


def _matches(doc: Dict[str, Any], filt: Dict[str, Any]) -> bool:
    """Subset of Mongo query matching used by this codebase."""
    for k, v in (filt or {}).items():
        if isinstance(v, dict):
            if "$ne" in v:
                if doc.get(k) == v["$ne"]:
                    return False
            elif "$in" in v:
                if doc.get(k) not in set(v["$in"]):
                    return False
            else:
                return False
        else:
            if doc.get(k) != v:
                return False
    return True


@dataclass
class _InsertOneResult:
    inserted_id: ObjectId


@dataclass
class _DeleteResult:
    deleted_count: int


@dataclass
class _UpdateResult:
    matched_count: int
    modified_count: int


class FakeCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = docs

    async def to_list(self, length: int = 1000):
        return list(self._docs)[:length]


class FakeCollection:
    def __init__(self):
        self._docs: List[Dict[str, Any]] = []

    async def create_index(self, *_args, **_kwargs):
        return None

    async def insert_one(self, doc: Dict[str, Any]) -> _InsertOneResult:
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = ObjectId()
        self._docs.append(d)
        return _InsertOneResult(inserted_id=d["_id"])

    async def find_one(self, filt: Dict[str, Any], proj: Optional[Dict[str, int]] = None):
        for d in self._docs:
            if _matches(d, filt):
                if not proj:
                    return dict(d)
                out = {"_id": d.get("_id")}
                for k, inc in proj.items():
                    if inc and k in d:
                        out[k] = d[k]
                return out
        return None

    def find(self, filt: Optional[Dict[str, Any]] = None, proj: Optional[Dict[str, int]] = None):
        out = []
        for d in self._docs:
            if _matches(d, filt or {}):
                if not proj:
                    out.append(dict(d))
                else:
                    dd = {"_id": d.get("_id")}
                    for k, inc in proj.items():
                        if inc and k in d:
                            dd[k] = d[k]
                    out.append(dd)
        return FakeCursor(out)

    async def update_one(self, filt: Dict[str, Any], update: Dict[str, Any]):
        for i, d in enumerate(self._docs):
            if _matches(d, filt):
                nd = dict(d)
                if "$set" in update:
                    nd.update(update["$set"])
                if "$addToSet" in update:
                    for k, v in update["$addToSet"].items():
                        arr = list(nd.get(k, []))
                        if isinstance(v, dict) and "$each" in v:
                            for it in v["$each"]:
                                if it not in arr:
                                    arr.append(it)
                        else:
                            if v not in arr:
                                arr.append(v)
                        nd[k] = arr
                self._docs[i] = nd
                return _UpdateResult(matched_count=1, modified_count=1)
        return _UpdateResult(matched_count=0, modified_count=0)

    async def delete_one(self, filt: Dict[str, Any]):
        before = len(self._docs)
        self._docs = [d for d in self._docs if not _matches(d, filt)]
        return _DeleteResult(deleted_count=before - len(self._docs))

    async def delete_many(self, filt: Dict[str, Any]):
        return await self.delete_one(filt)

    async def count_documents(self, filt: Optional[Dict[str, Any]] = None):
        return sum(1 for d in self._docs if _matches(d, filt or {}))

    def aggregate(self, _pipeline: List[Dict[str, Any]]):
        return FakeCursor([])


class FakeDB:
    def __init__(self):
        self._cols: Dict[str, FakeCollection] = {}
        self.name = "testdb"

    def __getitem__(self, name: str) -> FakeCollection:
        if name not in self._cols:
            self._cols[name] = FakeCollection()
        return self._cols[name]

    async def list_collection_names(self):
        return sorted(self._cols.keys())


class FakeClient:
    def __init__(self, db: FakeDB):
        self._db = db

    def __getitem__(self, _db_name: str) -> FakeDB:
        return self._db

    def close(self):
        return None


@pytest.fixture(scope="session")
def fake_db():
    return FakeDB()


@pytest.fixture(scope="session")
def client(fake_db):
    """FastAPI client with Mongo disabled + in-memory fake DB."""
    from app import main as main_mod
    from app.core import db as db_mod

    # Prevent real Mongo connections.
    main_mod.app.router.on_startup = []
    main_mod.app.router.on_shutdown = []

    db_mod._client = FakeClient(fake_db)

    os.environ.setdefault("RUN_INTEGRATION_TESTS", "0")
    return TestClient(main_mod.app)
