#!/usr/bin/env python3
import os, re
from pymongo import MongoClient

BAD = re.compile(
    r"(^\d+(\.\d+)?$)|(^\d{4}$)|(^[a-z]{1,2}$)|(\.$)", re.IGNORECASE
)

BAD_PHRASES = [
    "ability to", "equal opportunity", "applicants receive", "company name",
    "base salary", "benefits package"
]

def is_bad(name: str) -> bool:
    n = (name or "").strip()
    if not n:
        return True
    if BAD.search(n):
        return True
    low = n.lower()
    if any(p in low for p in BAD_PHRASES):
        return True
    if len(n) < 3:
        return True
    return False

def main():
    uri = os.getenv("MONGO_URI","mongodb://localhost:27017")
    dbn = os.getenv("MONGO_DB","skillbridge")
    db = MongoClient(uri)[dbn]

    to_delete = []
    for s in db.skills.find({}, {"name": 1}):
        if is_bad(s.get("name","")):
            to_delete.append(s["_id"])

    if not to_delete:
        print("No junk skills found.")
        return

    res = db.skills.delete_many({"_id": {"$in": to_delete}})
    print("Deleted:", res.deleted_count)

if __name__ == "__main__":
    main()

