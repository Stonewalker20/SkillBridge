"""Catalog seeding script that loads the broader predefined skill dataset into MongoDB."""

#!/usr/bin/env python3
from __future__ import annotations

import os
from datetime import datetime, timezone

from pymongo import MongoClient

from skill_catalog_data import SKILL_CATALOG


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_aliases(values: list[str] | None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values or []:
        text = str(value or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def main() -> None:
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGO_DB", "skillbridge")
    db = MongoClient(uri)[db_name]

    inserted = 0
    updated = 0

    for item in SKILL_CATALOG:
        name = str(item["name"]).strip()
        category = str(item["category"]).strip()
        aliases = normalize_aliases(item.get("aliases"))

        existing = db["skills"].find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
        doc = {
            "name": name,
            "category": category,
            "aliases": aliases,
            "tags": [],
            "origin": "default",
            "hidden": False,
            "updated_at": now_utc(),
        }

        if existing:
            db["skills"].update_one({"_id": existing["_id"]}, {"$set": doc})
            updated += 1
        else:
            db["skills"].insert_one(
                {
                    **doc,
                    "created_at": now_utc(),
                }
            )
            inserted += 1

    print(f"Seeded skill catalog entries: {len(SKILL_CATALOG)}")
    print(f"Inserted: {inserted}")
    print(f"Updated: {updated}")


if __name__ == "__main__":
    main()
