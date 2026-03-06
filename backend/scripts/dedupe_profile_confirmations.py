"""Cleanup script that merges duplicate profile confirmation records for the same user."""

#!/usr/bin/env python3
from __future__ import annotations

import os
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import MongoClient


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def oid_str(value) -> str:
    return str(value) if value is not None else ""


def merge_docs(docs: list[dict]) -> dict:
    confirmed_map: dict[str, dict] = {}
    rejected_map: dict[str, dict] = {}
    edited_map: dict[tuple[str, str], dict] = {}

    sorted_docs = sorted(
        docs,
        key=lambda d: (d.get("updated_at") or d.get("created_at") or datetime.min.replace(tzinfo=timezone.utc)),
        reverse=True,
    )

    canonical = sorted_docs[0]
    earliest_created = min((doc.get("created_at") for doc in sorted_docs if doc.get("created_at") is not None), default=now_utc())
    latest_updated = max((doc.get("updated_at") or doc.get("created_at") for doc in sorted_docs if (doc.get("updated_at") or doc.get("created_at")) is not None), default=now_utc())

    for doc in sorted_docs:
        for entry in doc.get("confirmed", []) or []:
            sid = oid_str(entry.get("skill_id"))
            if sid and sid not in confirmed_map:
                confirmed_map[sid] = {
                    "skill_id": entry.get("skill_id"),
                    "skill_name": entry.get("skill_name", ""),
                    "proficiency": int(entry.get("proficiency", 0)),
                }

        for entry in doc.get("rejected", []) or []:
            sid = oid_str(entry.get("skill_id"))
            if sid and sid not in rejected_map:
                rejected_map[sid] = {
                    "skill_id": entry.get("skill_id"),
                    "skill_name": entry.get("skill_name", ""),
                }

        for entry in doc.get("edited", []) or []:
            key = (str(entry.get("from_text", "")), oid_str(entry.get("to_skill_id")))
            if key[1] and key not in edited_map:
                edited_map[key] = {
                    "from_text": entry.get("from_text", ""),
                    "to_skill_id": entry.get("to_skill_id"),
                }

    return {
        "_id": canonical["_id"],
        "user_id": canonical["user_id"],
        "resume_snapshot_id": None,
        "confirmed": list(confirmed_map.values()),
        "rejected": list(rejected_map.values()),
        "edited": list(edited_map.values()),
        "created_at": earliest_created,
        "updated_at": latest_updated,
    }


def main() -> None:
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGO_DB", "skillbridge")
    db = MongoClient(uri)[db_name]

    pipeline = [
        {"$match": {"resume_snapshot_id": None}},
        {"$group": {"_id": "$user_id", "doc_ids": {"$push": "$_id"}, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
    ]

    duplicate_groups = list(db.resume_skill_confirmations.aggregate(pipeline))
    if not duplicate_groups:
        print("No duplicate profile confirmations found.")
        return

    users_fixed = 0
    docs_deleted = 0

    for group in duplicate_groups:
        user_id = group["_id"]
        docs = list(
            db.resume_skill_confirmations.find(
                {"user_id": user_id, "resume_snapshot_id": None}
            ).sort("updated_at", -1)
        )
        if len(docs) < 2:
            continue

        merged = merge_docs(docs)
        db.resume_skill_confirmations.update_one(
            {"_id": merged["_id"]},
            {
                "$set": {
                    "user_id": merged["user_id"],
                    "resume_snapshot_id": None,
                    "confirmed": merged["confirmed"],
                    "rejected": merged["rejected"],
                    "edited": merged["edited"],
                    "created_at": merged["created_at"],
                    "updated_at": merged["updated_at"],
                }
            },
        )

        stale_ids = [doc["_id"] for doc in docs[1:]]
        if stale_ids:
            result = db.resume_skill_confirmations.delete_many({"_id": {"$in": stale_ids}})
            docs_deleted += result.deleted_count
        users_fixed += 1
        print(f"Merged duplicate profile confirmations for user {user_id}")

    print(f"Users fixed: {users_fixed}")
    print(f"Duplicate docs deleted: {docs_deleted}")


if __name__ == "__main__":
    main()
