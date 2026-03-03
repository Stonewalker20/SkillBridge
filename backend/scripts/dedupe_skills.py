#!/usr/bin/env python3
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Iterable

from bson import ObjectId
from pymongo import MongoClient


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_dt(value) -> datetime:
    if not isinstance(value, datetime):
        return now_utc()
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def oid_str(value) -> str:
    return str(value) if value is not None else ""


def normalize_skill_name(value: str | None) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()


def unique_preserve(values: Iterable[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = re.sub(r"\s+", " ", str(value or "").strip())
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def choose_canonical_skill(docs: list[dict]) -> dict:
    def sort_key(doc: dict):
        created_by = doc.get("created_by_user_id")
        created_at = normalize_dt(doc.get("created_at"))
        updated_at = normalize_dt(doc.get("updated_at") or doc.get("created_at"))
        return (
            0 if created_by is None else 1,
            created_at,
            updated_at,
            oid_str(doc.get("_id")),
        )

    return sorted(docs, key=sort_key)[0]


def merge_skill_doc(canonical: dict, docs: list[dict]) -> dict:
    names = unique_preserve(doc.get("name", "") for doc in docs)
    aliases = unique_preserve(
        alias
        for doc in docs
        for alias in ([doc.get("name", "")] + list(doc.get("aliases") or []))
    )
    tags = unique_preserve(tag for doc in docs for tag in (doc.get("tags") or []))
    categories = unique_preserve(doc.get("category", "") for doc in docs)

    canonical_name = re.sub(r"\s+", " ", str(canonical.get("name") or "").strip())
    aliases = [alias for alias in aliases if normalize_skill_name(alias) != normalize_skill_name(canonical_name)]

    return {
        "name": canonical_name,
        "aliases": aliases,
        "tags": tags,
        "category": (canonical.get("category") or (categories[0] if categories else "") or "").strip(),
        "categories": categories,
        "updated_at": now_utc(),
    }


def remap_skill_id_list(values: Iterable[object], id_map: dict[str, ObjectId]) -> list[ObjectId]:
    out: list[ObjectId] = []
    seen: set[str] = set()
    for value in values or []:
        raw = oid_str(value)
        if not raw:
            continue
        mapped = id_map.get(raw)
        if mapped is None:
            if isinstance(value, ObjectId):
                mapped = value
            elif ObjectId.is_valid(raw):
                mapped = ObjectId(raw)
            else:
                continue
        key = oid_str(mapped)
        if key in seen:
            continue
        seen.add(key)
        out.append(mapped)
    return out


def remap_confirmation_entries(entries: list[dict], id_map: dict[str, ObjectId], name_by_id: dict[str, str], field: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for entry in entries or []:
        raw = oid_str(entry.get(field))
        if not raw:
            continue
        mapped = id_map.get(raw)
        if mapped is None:
            if ObjectId.is_valid(raw):
                mapped = ObjectId(raw)
            else:
                continue
        key = oid_str(mapped)
        if key in seen:
            continue
        seen.add(key)
        next_entry = {**entry, field: mapped}
        if field == "skill_id":
            next_entry["skill_name"] = name_by_id.get(key, entry.get("skill_name", ""))
        out.append(next_entry)
    return out


def main() -> None:
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGO_DB", "skillbridge")
    db = MongoClient(uri)[db_name]

    skills = list(
        db.skills.find(
            {},
            {
                "name": 1,
                "category": 1,
                "aliases": 1,
                "tags": 1,
                "hidden": 1,
                "origin": 1,
                "created_by_user_id": 1,
                "created_at": 1,
                "updated_at": 1,
            },
        )
    )

    groups: dict[str, list[dict]] = {}
    for doc in skills:
        key = normalize_skill_name(doc.get("name"))
        if not key:
            continue
        groups.setdefault(key, []).append(doc)

    duplicate_groups = {key: docs for key, docs in groups.items() if len(docs) > 1}
    if not duplicate_groups:
        print("No duplicate skills found.")
        return

    id_map: dict[str, ObjectId] = {}
    names_by_canonical_id: dict[str, str] = {}
    duplicate_ids_to_delete: list[ObjectId] = []
    skills_merged = 0

    for docs in duplicate_groups.values():
        canonical = choose_canonical_skill(docs)
        canonical_id = canonical["_id"]
        merged = merge_skill_doc(canonical, docs)
        db.skills.update_one({"_id": canonical_id}, {"$set": merged})

        names_by_canonical_id[oid_str(canonical_id)] = merged["name"]
        for doc in docs:
            doc_id = doc["_id"]
            id_map[oid_str(doc_id)] = canonical_id
            if doc_id != canonical_id:
                duplicate_ids_to_delete.append(doc_id)
        skills_merged += len(docs) - 1

    evidence_updates = 0
    for evidence in db.evidence.find({}, {"skill_ids": 1}):
        current_ids = list(evidence.get("skill_ids") or [])
        remapped = remap_skill_id_list(current_ids, id_map)
        if [oid_str(value) for value in remapped] != [oid_str(value) for value in current_ids]:
            db.evidence.update_one(
                {"_id": evidence["_id"]},
                {"$set": {"skill_ids": remapped, "updated_at": now_utc()}},
            )
            evidence_updates += 1

    confirmation_updates = 0
    for doc in db.resume_skill_confirmations.find({}, {"confirmed": 1, "rejected": 1, "edited": 1}):
        confirmed = remap_confirmation_entries(doc.get("confirmed", []), id_map, names_by_canonical_id, "skill_id")
        rejected = remap_confirmation_entries(doc.get("rejected", []), id_map, names_by_canonical_id, "skill_id")
        edited = remap_confirmation_entries(doc.get("edited", []), id_map, names_by_canonical_id, "to_skill_id")

        current_confirmed = [oid_str(entry.get("skill_id")) for entry in doc.get("confirmed", []) or []]
        next_confirmed = [oid_str(entry.get("skill_id")) for entry in confirmed]
        current_rejected = [oid_str(entry.get("skill_id")) for entry in doc.get("rejected", []) or []]
        next_rejected = [oid_str(entry.get("skill_id")) for entry in rejected]
        current_edited = [oid_str(entry.get("to_skill_id")) for entry in doc.get("edited", []) or []]
        next_edited = [oid_str(entry.get("to_skill_id")) for entry in edited]

        if current_confirmed != next_confirmed or current_rejected != next_rejected or current_edited != next_edited:
            db.resume_skill_confirmations.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "confirmed": confirmed,
                        "rejected": rejected,
                        "edited": edited,
                        "updated_at": now_utc(),
                    }
                },
            )
            confirmation_updates += 1

    project_link_updates = 0
    for doc in db.project_skill_links.find({"skill_id": {"$in": duplicate_ids_to_delete}}, {"skill_id": 1}):
        raw = oid_str(doc.get("skill_id"))
        mapped = id_map.get(raw)
        if mapped is None or oid_str(mapped) == raw:
            continue
        db.project_skill_links.update_one({"_id": doc["_id"]}, {"$set": {"skill_id": mapped}})
        project_link_updates += 1

    portfolio_updates = 0
    for item in db.portfolio_items.find({}, {"skill_ids": 1}):
        current_ids = list(item.get("skill_ids") or [])
        remapped = remap_skill_id_list(current_ids, id_map)
        if [oid_str(value) for value in remapped] != [oid_str(value) for value in current_ids]:
            db.portfolio_items.update_one(
                {"_id": item["_id"]},
                {"$set": {"skill_ids": remapped, "updated_at": now_utc()}},
            )
            portfolio_updates += 1

    tailored_updates = 0
    for doc in db.tailored_resumes.find({}, {"selected_skill_ids": 1}):
        current_ids = list(doc.get("selected_skill_ids") or [])
        remapped = remap_skill_id_list(current_ids, id_map)
        if [oid_str(value) for value in remapped] != [oid_str(value) for value in current_ids]:
            db.tailored_resumes.update_one(
                {"_id": doc["_id"]},
                {"$set": {"selected_skill_ids": remapped, "updated_at": now_utc()}},
            )
            tailored_updates += 1

    taxonomy_from_updates = 0
    for doc in db.skill_relations.find({"from_skill_id": {"$in": duplicate_ids_to_delete}}, {"from_skill_id": 1}):
        raw = oid_str(doc.get("from_skill_id"))
        mapped = id_map.get(raw)
        if mapped is None or oid_str(mapped) == raw:
            continue
        db.skill_relations.update_one({"_id": doc["_id"]}, {"$set": {"from_skill_id": mapped}})
        taxonomy_from_updates += 1

    taxonomy_to_updates = 0
    for doc in db.skill_relations.find({"to_skill_id": {"$in": duplicate_ids_to_delete}}, {"to_skill_id": 1}):
        raw = oid_str(doc.get("to_skill_id"))
        mapped = id_map.get(raw)
        if mapped is None or oid_str(mapped) == raw:
            continue
        db.skill_relations.update_one({"_id": doc["_id"]}, {"$set": {"to_skill_id": mapped}})
        taxonomy_to_updates += 1

    deleted = 0
    if duplicate_ids_to_delete:
        deleted = db.skills.delete_many({"_id": {"$in": duplicate_ids_to_delete}}).deleted_count

    print(f"Duplicate groups merged: {len(duplicate_groups)}")
    print(f"Duplicate skill rows removed: {skills_merged}")
    print(f"Evidence docs remapped: {evidence_updates}")
    print(f"Confirmation docs remapped: {confirmation_updates}")
    print(f"Portfolio items remapped: {portfolio_updates}")
    print(f"Tailored resumes remapped: {tailored_updates}")
    print(f"Project skill links remapped: {project_link_updates}")
    print(f"Taxonomy relation from_skill_id remapped: {taxonomy_from_updates}")
    print(f"Taxonomy relation to_skill_id remapped: {taxonomy_to_updates}")
    print(f"Duplicate skill docs deleted: {deleted}")


if __name__ == "__main__":
    main()
