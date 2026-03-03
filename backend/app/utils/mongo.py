from __future__ import annotations
from bson import ObjectId
from typing import Any


def oid_str(oid: Any) -> str:
    return "" if oid is None else str(oid)


def try_object_id(value: Any) -> ObjectId | None:
    if isinstance(value, ObjectId):
        return value
    s = str(value or "").strip()
    if not s:
        return None
    try:
        return ObjectId(s)
    except Exception:
        return None


def to_object_id(id_str: str) -> ObjectId:
    oid = try_object_id(id_str)
    if oid is None:
        raise ValueError(f"Invalid ObjectId: {id_str}")
    return oid


def ref_values(value: Any) -> list[Any]:
    oid = try_object_id(value)
    if oid is not None:
        return [oid, str(oid)]
    s = str(value or "").strip()
    return [s] if s else []


def ref_query(field: str, value: Any) -> dict[str, Any]:
    values = ref_values(value)
    if not values:
        return {}
    if len(values) == 1:
        return {field: values[0]}
    return {field: {"$in": values}}

