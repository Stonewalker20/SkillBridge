"""Cleanup script that marks noisy or test-like skills as hidden so they stay out of product flows."""

#!/usr/bin/env python3
from __future__ import annotations

import os
import re
from pymongo import MongoClient

TEST_SKILL_PATTERN = re.compile(r"\b(test|demo|sample|mock|dummy|placeholder)\b", re.IGNORECASE)
BAD_SKILL_PATTERN = re.compile(r"(^\d+(\.\d+)?$)|(^\d{4}$)|(^[a-z]{1,2}$)|(\.$)", re.IGNORECASE)
BAD_SKILL_PHRASES = [
    "ability to",
    "equal opportunity",
    "applicants receive",
    "company name",
    "base salary",
    "benefits package",
]
ALLOWED_SHORT_SKILLS = {"c", "c#", "c++", "go", "r", "ui", "ux", "qa", "bi", "ml", "ai"}


def should_hide(name: str) -> bool:
    normalized = (name or "").strip()
    if not normalized:
        return True
    lower = normalized.lower()
    if TEST_SKILL_PATTERN.search(normalized):
        return True
    if lower not in ALLOWED_SHORT_SKILLS and BAD_SKILL_PATTERN.search(normalized):
        return True
    if any(phrase in lower for phrase in BAD_SKILL_PHRASES):
        return True
    return False


def main() -> None:
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGO_DB", "skillbridge")
    db = MongoClient(uri)[db_name]

    to_hide = []
    for skill in db.skills.find({}, {"name": 1, "hidden": 1}):
        if should_hide(skill.get("name", "")) and skill.get("hidden") is not True:
            to_hide.append(skill["_id"])

    if not to_hide:
        print("No junk/test skills needed hiding.")
        return

    result = db.skills.update_many({"_id": {"$in": to_hide}}, {"$set": {"hidden": True}})
    print(f"Marked hidden: {result.modified_count}")


if __name__ == "__main__":
    main()
