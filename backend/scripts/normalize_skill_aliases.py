#!/usr/bin/env python3
from __future__ import annotations

import os
from datetime import datetime, timezone

from pymongo import MongoClient
from app.utils.skill_catalog import expand_alias_variants, normalize_skill_text, unique_casefolded


def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def main() -> None:
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGO_DB", "skillbridge")
    db = MongoClient(uri)[db_name]

    updated = 0
    scanned = 0

    for skill in db.skills.find({}, {"name": 1, "aliases": 1}):
        scanned += 1
        name = str(skill.get("name") or "").strip()
        name_key = normalize_skill_text(name)
        aliases = [
            alias
            for alias in expand_alias_variants(unique_casefolded(skill.get("aliases") or []), base_name=name)
            if normalize_skill_text(alias) and normalize_skill_text(alias) != name_key
        ]

        current_aliases = [" ".join(str(value or "").strip().split()) for value in (skill.get("aliases") or []) if str(value or "").strip()]
        if current_aliases != aliases:
            db.skills.update_one(
                {"_id": skill["_id"]},
                {"$set": {"aliases": aliases, "updated_at": now_utc()}},
            )
            updated += 1

    print(f"Skills scanned: {scanned}")
    print(f"Skills updated: {updated}")


if __name__ == "__main__":
    main()
