"""Helpers for canonical job ingest storage and joined job moderation reads."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from bson import ObjectId

from app.utils.mongo import canonical_object_ref, oid_str, unique_strings
from app.utils.skill_catalog import normalize_skill_text


def serialize_extracted_skill(entry: dict[str, Any]) -> dict[str, Any] | None:
    skill_name = str(entry.get("skill_name") or "").strip()
    skill_id = canonical_object_ref(entry.get("skill_id"))
    if not skill_name and skill_id is None:
        return None
    return {
        "skill_id": oid_str(skill_id),
        "skill_name": skill_name,
        "matched_on": str(entry.get("matched_on") or "name").strip() or "name",
        "count": int(entry.get("count") or 1),
    }


def normalize_extracted_skills(entries: Iterable[Any]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen: dict[str, int] = {}

    for raw in entries or []:
        if hasattr(raw, "model_dump"):
            raw = raw.model_dump()
        if not isinstance(raw, dict):
            continue

        skill_oid = canonical_object_ref(raw.get("skill_id"))
        skill_name = str(raw.get("skill_name") or "").strip()
        matched_on = str(raw.get("matched_on") or "name").strip() or "name"
        count = max(1, int(raw.get("count") or 1))
        key = oid_str(skill_oid) or normalize_skill_text(skill_name)
        if not key:
            continue

        existing_index = seen.get(key)
        if existing_index is not None:
            normalized[existing_index]["count"] += count
            if not normalized[existing_index].get("skill_name") and skill_name:
                normalized[existing_index]["skill_name"] = skill_name
            continue

        seen[key] = len(normalized)
        normalized.append(
            {
                "skill_id": skill_oid,
                "skill_name": skill_name,
                "matched_on": matched_on,
                "count": count,
            }
        )

    return normalized


def derive_required_skills(extracted_skills: Iterable[dict[str, Any]]) -> tuple[list[str], list[ObjectId]]:
    skill_names: list[str] = []
    skill_ids: list[ObjectId] = []
    seen_skill_ids: set[str] = set()

    for entry in extracted_skills or []:
        skill_name = str(entry.get("skill_name") or "").strip()
        skill_oid = canonical_object_ref(entry.get("skill_id"))
        if skill_name:
            skill_names.append(skill_name)
        if skill_oid is None:
            continue
        key = str(skill_oid)
        if key in seen_skill_ids:
            continue
        seen_skill_ids.add(key)
        skill_ids.append(skill_oid)

    return unique_strings(skill_names), skill_ids


def linked_job_ingest_oid(job_doc: dict[str, Any] | None) -> ObjectId | None:
    if not isinstance(job_doc, dict):
        return None
    return canonical_object_ref(job_doc.get("job_ingest_id"))


def hydrate_job_doc(job_doc: dict[str, Any], ingest_doc: dict[str, Any] | None = None) -> dict[str, Any]:
    merged = dict(job_doc or {})
    ingest = ingest_doc or {}
    extracted = normalize_extracted_skills(ingest.get("extracted_skills") or [])
    required_skills, required_skill_ids = derive_required_skills(extracted)

    if ingest:
        if str(ingest.get("title") or "").strip():
            merged["title"] = ingest.get("title")
        if str(ingest.get("company") or "").strip():
            merged["company"] = ingest.get("company")
        if str(ingest.get("location") or "").strip():
            merged["location"] = ingest.get("location")
        if str(ingest.get("text") or "").strip():
            merged["description_full"] = ingest.get("text")
        preview = " ".join(str(ingest.get("text") or "").split())
        if preview:
            merged["description_excerpt"] = preview[:220] + ("..." if len(preview) > 220 else "")
        merged["required_skills"] = required_skills
        merged["required_skill_ids"] = required_skill_ids
    else:
        merged["required_skills"] = unique_strings(merged.get("required_skills") or [])
        merged["required_skill_ids"] = [
            oid
            for oid in (canonical_object_ref(value) for value in (merged.get("required_skill_ids") or []))
            if oid is not None
        ]

    merged["role_ids"] = [
        oid
        for oid in (canonical_object_ref(value) for value in (merged.get("role_ids") or []))
        if oid is not None
    ]
    submitted_by = canonical_object_ref(merged.get("submitted_by_user_id"))
    merged["submitted_by_user_id"] = submitted_by if submitted_by is not None else merged.get("submitted_by_user_id")
    return merged
