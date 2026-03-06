"""In-memory MongoDB test double used to exercise route logic without a real database."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from typing import Any
import re

from bson import ObjectId


def _deepcopy(doc: Any) -> Any:
    return deepcopy(doc)


def _ensure_object_id(value: Any) -> ObjectId:
    if isinstance(value, ObjectId):
        return value
    return ObjectId(str(value))


def _get_raw_value(doc: Any, path: str) -> Any:
    current = doc
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _get_values(doc: Any, path: str) -> list[Any]:
    parts = path.split(".")

    def walk(value: Any, remaining: list[str]) -> list[Any]:
        if not remaining:
            if isinstance(value, list):
                return list(value)
            return [value]
        part = remaining[0]
        rest = remaining[1:]
        if isinstance(value, list):
            out: list[Any] = []
            for item in value:
                out.extend(walk(item, remaining))
            return out
        if isinstance(value, dict):
            return walk(value.get(part), rest)
        return []

    return [value for value in walk(doc, parts) if value is not None]


def _set_path(doc: dict, path: str, value: Any) -> None:
    current = doc
    parts = path.split(".")
    for part in parts[:-1]:
        if part not in current or not isinstance(current[part], dict):
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


def _unset_path(doc: dict, path: str) -> None:
    current = doc
    parts = path.split(".")
    for part in parts[:-1]:
        current = current.get(part)
        if not isinstance(current, dict):
            return
    if isinstance(current, dict):
        current.pop(parts[-1], None)


def _normalize_sort_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.timestamp()
    if value is None:
        return 0
    return value


def _regex_match(pattern: Any, candidate: Any) -> bool:
    text = "" if candidate is None else str(candidate)
    if isinstance(pattern, re.Pattern):
        return bool(pattern.search(text))
    return False


def _matches_operator(values: list[Any], raw_value: Any, operator: str, expected: Any) -> bool:
    if operator == "$in":
        expected_values = list(expected or [])
        for value in values:
            for item in expected_values:
                if isinstance(item, re.Pattern):
                    if _regex_match(item, value):
                        return True
                elif value == item:
                    return True
        if raw_value in expected_values:
            return True
        return False
    if operator == "$lt":
        return any(value < expected for value in values)
    if operator == "$ne":
        return all(value != expected for value in values) and raw_value != expected
    if operator == "$regex":
        if isinstance(expected, str):
            flags = 0
            return any(re.search(expected, str(value), flags) for value in values)
        return any(_regex_match(expected, value) for value in values)
    if operator == "$options":
        return True
    return False


def match_query(doc: dict, query: dict | None) -> bool:
    if not query:
        return True
    for key, expected in query.items():
        if key == "$or":
            return any(match_query(doc, option) for option in expected)
        raw_value = _get_raw_value(doc, key)
        values = _get_values(doc, key)
        if isinstance(expected, dict):
            for operator, operand in expected.items():
                if not _matches_operator(values, raw_value, operator, operand):
                    return False
            continue
        if isinstance(expected, re.Pattern):
            if not any(_regex_match(expected, value) for value in values):
                return False
            continue
        if raw_value == expected:
            continue
        if expected not in values:
            return False
    return True


def _project_doc(doc: dict, projection: dict | None) -> dict:
    if not projection:
        return _deepcopy(doc)
    out: dict[str, Any] = {}
    include_id = projection.get("_id", 1) != 0
    if include_id and "_id" in doc:
        out["_id"] = doc["_id"]
    for key, spec in projection.items():
        if key == "_id":
            continue
        if spec == 1:
            value = _get_raw_value(doc, key)
            if value is not None:
                out[key] = _deepcopy(value)
        elif isinstance(spec, str) and spec.startswith("$"):
            out[key] = _deepcopy(_get_raw_value(doc, spec[1:]))
        elif isinstance(spec, dict) and "$size" in spec:
            target = spec["$size"]
            if isinstance(target, str) and target.startswith("$"):
                value = _get_raw_value(doc, target[1:])
                out[key] = len(value or [])
    return out


@dataclass
class FakeInsertOneResult:
    inserted_id: ObjectId


@dataclass
class FakeUpdateResult:
    matched_count: int
    modified_count: int
    upserted_id: ObjectId | None = None


@dataclass
class FakeDeleteResult:
    deleted_count: int


class FakeCursor:
    def __init__(self, docs: list[dict]):
        self._docs = [_deepcopy(doc) for doc in docs]

    def sort(self, key: str | list[tuple[str, int]], direction: int | None = None):
        sort_fields = key if isinstance(key, list) else [(key, direction or 1)]
        for field, order in reversed(sort_fields):
            reverse = order == -1
            self._docs.sort(key=lambda doc: _normalize_sort_value(_get_raw_value(doc, field)), reverse=reverse)
        return self

    def limit(self, length: int):
        self._docs = self._docs[:length]
        return self

    async def to_list(self, length: int):
        return [_deepcopy(doc) for doc in self._docs[:length]]

    def __aiter__(self):
        self._iter_index = 0
        return self

    async def __anext__(self):
        if self._iter_index >= len(self._docs):
            raise StopAsyncIteration
        value = _deepcopy(self._docs[self._iter_index])
        self._iter_index += 1
        return value


class FakeCollection:
    def __init__(self, db: "FakeDatabase", name: str):
        self.db = db
        self.name = name
        self.docs: list[dict] = []

    async def create_index(self, *args, **kwargs):
        return None

    def find(self, query: dict | None = None, projection: dict | None = None):
        docs = [_project_doc(doc, projection) for doc in self.docs if match_query(doc, query)]
        return FakeCursor(docs)

    async def find_one(self, query: dict, projection: dict | None = None, sort: list[tuple[str, int]] | None = None):
        docs = [doc for doc in self.docs if match_query(doc, query)]
        if sort:
            docs = FakeCursor(docs).sort(sort)._docs
        if not docs:
            return None
        return _project_doc(docs[0], projection)

    async def insert_one(self, doc: dict):
        stored = _deepcopy(doc)
        stored.setdefault("_id", ObjectId())
        self.docs.append(stored)
        return FakeInsertOneResult(stored["_id"])

    async def update_one(self, query: dict, update: dict, upsert: bool = False):
        for index, doc in enumerate(self.docs):
            if match_query(doc, query):
                self.docs[index] = _apply_update(doc, update)
                return FakeUpdateResult(matched_count=1, modified_count=1)
        if upsert:
            new_doc = {}
            for key, value in query.items():
                if not key.startswith("$"):
                    _set_path(new_doc, key, value)
            new_doc = _apply_update(new_doc, update, inserting=True)
            new_doc.setdefault("_id", ObjectId())
            self.docs.append(new_doc)
            return FakeUpdateResult(matched_count=0, modified_count=0, upserted_id=new_doc["_id"])
        return FakeUpdateResult(matched_count=0, modified_count=0)

    async def update_many(self, query: dict, update: dict, upsert: bool = False):
        matched = 0
        for index, doc in enumerate(list(self.docs)):
            if match_query(doc, query):
                self.docs[index] = _apply_update(doc, update)
                matched += 1
        if matched == 0 and upsert:
            return await self.update_one(query, update, upsert=True)
        return FakeUpdateResult(matched_count=matched, modified_count=matched)

    async def delete_one(self, query: dict):
        for index, doc in enumerate(self.docs):
            if match_query(doc, query):
                del self.docs[index]
                return FakeDeleteResult(deleted_count=1)
        return FakeDeleteResult(deleted_count=0)

    async def delete_many(self, query: dict):
        remaining = []
        deleted = 0
        for doc in self.docs:
            if match_query(doc, query):
                deleted += 1
            else:
                remaining.append(doc)
        self.docs = remaining
        return FakeDeleteResult(deleted_count=deleted)

    async def count_documents(self, query: dict):
        return sum(1 for doc in self.docs if match_query(doc, query))

    async def distinct(self, field: str, query: dict | None = None):
        values: list[Any] = []
        seen: list[Any] = []
        for doc in self.docs:
            if not match_query(doc, query):
                continue
            for value in _get_values(doc, field):
                if value not in seen:
                    seen.append(value)
                    values.append(_deepcopy(value))
        return values

    def aggregate(self, pipeline: list[dict]):
        docs = [_deepcopy(doc) for doc in self.docs]
        for stage in pipeline:
            name, spec = next(iter(stage.items()))
            if name == "$match":
                docs = [doc for doc in docs if match_query(doc, spec)]
            elif name == "$unwind":
                path = spec["path"][1:] if str(spec.get("path", "")).startswith("$") else spec["path"]
                preserve = spec.get("preserveNullAndEmptyArrays", False)
                unwound: list[dict] = []
                for doc in docs:
                    value = _get_raw_value(doc, path)
                    if isinstance(value, list) and value:
                        for item in value:
                            clone = _deepcopy(doc)
                            _set_path(clone, path, item)
                            unwound.append(clone)
                    elif preserve:
                        unwound.append(doc)
                docs = unwound
            elif name == "$group":
                grouped: dict[Any, dict] = {}
                for doc in docs:
                    group_id = _eval_expr(doc, spec.get("_id"))
                    key = repr(group_id)
                    if key not in grouped:
                        grouped[key] = {"_id": group_id}
                        for field, expr in spec.items():
                            if field == "_id":
                                continue
                            if "$sum" in expr:
                                grouped[key][field] = 0
                            if "$avg" in expr:
                                grouped[key][field] = {"total": 0, "count": 0}
                    for field, expr in spec.items():
                        if field == "_id":
                            continue
                        if "$sum" in expr:
                            operand = expr["$sum"]
                            increment = _eval_expr(doc, operand)
                            grouped[key][field] += increment
                        elif "$avg" in expr:
                            operand = expr["$avg"]
                            value = _eval_expr(doc, operand)
                            grouped[key][field]["total"] += value
                            grouped[key][field]["count"] += 1
                finalized: list[dict] = []
                for group in grouped.values():
                    record = {}
                    for field, value in group.items():
                        if isinstance(value, dict) and {"total", "count"} <= value.keys():
                            record[field] = (value["total"] / value["count"]) if value["count"] else 0
                        else:
                            record[field] = value
                    finalized.append(record)
                docs = finalized
            elif name == "$sort":
                sort_fields = list(spec.items())
                for field, order in reversed(sort_fields):
                    docs.sort(key=lambda doc: _normalize_sort_value(_get_raw_value(doc, field)), reverse=order == -1)
            elif name == "$limit":
                docs = docs[: int(spec)]
            elif name == "$count":
                docs = [{spec: len(docs)}]
            elif name == "$lookup":
                foreign = self.db[spec["from"]].docs
                local_field = spec["localField"]
                foreign_field = spec["foreignField"]
                alias = spec["as"]
                joined: list[dict] = []
                for doc in docs:
                    local_values = _get_values(doc, local_field)
                    matches = []
                    for candidate in foreign:
                        foreign_values = _get_values(candidate, foreign_field)
                        if any(value in foreign_values for value in local_values):
                            matches.append(_deepcopy(candidate))
                    clone = _deepcopy(doc)
                    clone[alias] = matches
                    joined.append(clone)
                docs = joined
            elif name == "$project":
                docs = [_project_doc(doc, spec) for doc in docs]
            else:
                raise NotImplementedError(f"Unsupported aggregate stage: {name}")
        return FakeCursor(docs)


def _eval_expr(doc: dict, expr: Any) -> Any:
    if isinstance(expr, str) and expr.startswith("$"):
        value = _get_raw_value(doc, expr[1:])
        if value is None:
            values = _get_values(doc, expr[1:])
            if len(values) == 1:
                return values[0]
            return values
        return value
    if isinstance(expr, (int, float)):
        return expr
    return expr


def _matches_pull(item: Any, matcher: Any) -> bool:
    if isinstance(item, dict) and isinstance(matcher, dict):
        return match_query(item, matcher)
    if isinstance(matcher, dict):
        return _matches_operator([item], item, next(iter(matcher.keys())), next(iter(matcher.values())))
    return item == matcher


def _apply_update(doc: dict, update: dict, inserting: bool = False) -> dict:
    next_doc = _deepcopy(doc)
    for operator, payload in update.items():
        if operator == "$set":
            for path, value in payload.items():
                _set_path(next_doc, path, value)
        elif operator == "$unset":
            for path in payload.keys():
                _unset_path(next_doc, path)
        elif operator == "$setOnInsert" and inserting:
            for path, value in payload.items():
                _set_path(next_doc, path, value)
        elif operator == "$addToSet":
            for path, value in payload.items():
                current = _get_raw_value(next_doc, path)
                if current is None:
                    current = []
                    _set_path(next_doc, path, current)
                if value not in current:
                    current.append(value)
        elif operator == "$pull":
            for path, matcher in payload.items():
                current = _get_raw_value(next_doc, path) or []
                if isinstance(current, list):
                    filtered = [item for item in current if not _matches_pull(item, matcher)]
                    _set_path(next_doc, path, filtered)
        else:
            raise NotImplementedError(f"Unsupported update operator: {operator}")
    return next_doc


class FakeDatabase:
    def __init__(self, name: str = "skillbridge_test"):
        self._collections: dict[str, FakeCollection] = {}
        self.name = name

    def __getitem__(self, name: str) -> FakeCollection:
        if name not in self._collections:
            self._collections[name] = FakeCollection(self, name)
        return self._collections[name]

    async def list_collection_names(self) -> list[str]:
        return sorted(self._collections.keys())


class FakeMongoClient:
    def __init__(self, db: FakeDatabase):
        self.db = db

    def __getitem__(self, name: str) -> FakeDatabase:
        return self.db

    def close(self):
        return None
