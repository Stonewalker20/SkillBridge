#!/usr/bin/env python3
"""Staged-safe MongoDB cleanup for SkillBridge."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from bson import ObjectId, json_util
from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils.job_records import derive_required_skills, normalize_extracted_skills
from app.utils.mongo import canonical_object_ref, canonical_object_refs, oid_str, unique_strings
from app.utils.portfolio_records import portfolio_item_to_evidence_doc


TARGET_COLLECTIONS = [
    "evidence",
    "projects",
    "portfolio_items",
    "job_ingests",
    "jobs",
    "job_match_runs",
    "tailored_resumes",
    "resume_skill_confirmations",
    "resume_snapshots",
    "learning_path_progress",
    "skill_relations",
]


def now_utc() -> datetime:
    return datetime.now(UTC)


def parse_args() -> argparse.Namespace:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uri", default=None, help="Mongo URI. Defaults to MONGO_URI from backend/.env.")
    parser.add_argument("--db", default=None, help="Mongo database. Defaults to MONGO_DB from backend/.env.")
    parser.add_argument("--apply", action="store_true", help="Apply updates. Default is dry-run.")
    parser.add_argument("--backup-dir", default=None, help="Directory for JSON backups when applying changes.")
    parser.add_argument("--report-path", default=None, help="Optional JSON report output path.")
    return parser.parse_args()


def env_default(name: str, fallback: str) -> str:
    import os

    return str(os.getenv(name) or fallback).strip() or fallback


def load_existing_ids(db, collection: str) -> set[str]:
    return {oid_str(doc["_id"]) for doc in db[collection].find({}, {"_id": 1})}


def serialize_lines(collection) -> list[str]:
    return [json_util.dumps(doc) for doc in collection.find({})]


def write_backup(db, backup_dir: Path) -> None:
    backup_dir.mkdir(parents=True, exist_ok=True)
    for name in TARGET_COLLECTIONS:
        path = backup_dir / f"{name}.jsonl"
        path.write_text("\n".join(serialize_lines(db[name])) + "\n", encoding="utf-8")


def canonical_user_ref(value: Any, valid_user_ids: set[str]) -> Any:
    oid = canonical_object_ref(value)
    if oid is not None and str(oid) in valid_user_ids:
        return oid
    text = str(value or "").strip()
    return text or None


def canonical_optional_ref(value: Any, valid_ids: set[str]) -> ObjectId | None:
    oid = canonical_object_ref(value)
    if oid is None or str(oid) not in valid_ids:
        return None
    return oid


def canonical_existing_refs(values: Any, valid_ids: set[str]) -> list[ObjectId]:
    normalized: list[ObjectId] = []
    seen: set[str] = set()
    for oid in canonical_object_refs(values):
        key = str(oid)
        if key not in valid_ids or key in seen:
            continue
        seen.add(key)
        normalized.append(oid)
    return normalized


def audit_state(db) -> dict[str, Any]:
    metrics: dict[str, Any] = {"collections": {}}
    for name in TARGET_COLLECTIONS:
        metrics["collections"][name] = db[name].count_documents({})

    metrics["portfolio_items_in_evidence"] = db["evidence"].count_documents({"structured_evidence": True})
    metrics["legacy_portfolio_items"] = db["portfolio_items"].count_documents({})
    metrics["projects_with_embedded_skill_ids"] = db["projects"].count_documents({"skill_ids": {"$exists": True, "$ne": []}})
    metrics["jobs_with_job_ingest_id"] = db["jobs"].count_documents({"job_ingest_id": {"$exists": True}})

    def count_missing_skill_refs_from_array_docs(coll_name: str, field: str) -> dict[str, int]:
        existing = load_existing_ids(db, "skills")
        docs = 0
        refs = 0
        for doc in db[coll_name].find({}, {field: 1}):
            values = [oid_str(value) for value in (doc.get(field) or []) if oid_str(value)]
            missing = [value for value in values if value not in existing]
            if missing:
                docs += 1
                refs += len(missing)
        return {"docs": docs, "refs": refs}

    def count_missing_nested(coll_name: str, field: str, key: str) -> dict[str, int]:
        existing = load_existing_ids(db, "skills")
        docs = 0
        refs = 0
        for doc in db[coll_name].find({}, {field: 1}):
            values = [oid_str(value.get(key)) for value in (doc.get(field) or []) if isinstance(value, dict) and oid_str(value.get(key))]
            missing = [value for value in values if value not in existing]
            if missing:
                docs += 1
                refs += len(missing)
        return {"docs": docs, "refs": refs}

    metrics["stale_skill_refs"] = {
        "evidence.skill_ids": count_missing_skill_refs_from_array_docs("evidence", "skill_ids"),
        "portfolio_items.skill_ids": count_missing_skill_refs_from_array_docs("portfolio_items", "skill_ids"),
        "jobs.required_skill_ids": count_missing_skill_refs_from_array_docs("jobs", "required_skill_ids"),
        "tailored_resumes.selected_skill_ids": count_missing_skill_refs_from_array_docs("tailored_resumes", "selected_skill_ids"),
        "job_ingests.extracted_skills.skill_id": count_missing_nested("job_ingests", "extracted_skills", "skill_id"),
    }
    return metrics


def normalize_evidence(db, apply: bool, valid_skill_ids: set[str], valid_project_ids: set[str], valid_user_ids: set[str]) -> Counter:
    stats = Counter()
    for doc in db["evidence"].find({}):
        updates: dict[str, Any] = {}
        user_ref = canonical_user_ref(doc.get("user_id"), valid_user_ids)
        if user_ref != doc.get("user_id"):
            updates["user_id"] = user_ref
        normalized_skills = canonical_existing_refs(doc.get("skill_ids") or [], valid_skill_ids)
        if normalized_skills != list(doc.get("skill_ids") or []):
            updates["skill_ids"] = normalized_skills
            stats["evidence_skill_ids_normalized"] += 1
        project_ref = canonical_optional_ref(doc.get("project_id"), valid_project_ids)
        if project_ref != doc.get("project_id"):
            updates["project_id"] = project_ref
            stats["evidence_project_ids_normalized"] += 1
        if updates:
            stats["evidence_docs_changed"] += 1
            if apply:
                db["evidence"].update_one({"_id": doc["_id"]}, {"$set": updates})
    return stats


def reconcile_portfolio_items(db, apply: bool, valid_skill_ids: set[str], valid_user_ids: set[str]) -> Counter:
    stats = Counter()
    evidence_keys = {
        oid_str(doc.get("legacy_portfolio_item_id")) or oid_str(doc.get("_id"))
        for doc in db["evidence"].find({"structured_evidence": True}, {"_id": 1, "legacy_portfolio_item_id": 1})
    }
    for doc in db["portfolio_items"].find({}):
        legacy_key = oid_str(doc.get("_id"))
        if legacy_key in evidence_keys:
            continue
        migrated = portfolio_item_to_evidence_doc(doc, preserve_id=True)
        migrated["user_id"] = canonical_user_ref(doc.get("user_id"), valid_user_ids)
        migrated["skill_ids"] = canonical_existing_refs(doc.get("skill_ids") or [], valid_skill_ids)
        stats["portfolio_items_to_reconcile"] += 1
        if apply:
            db["evidence"].replace_one({"_id": migrated["_id"]}, migrated, upsert=True)
    for doc in db["portfolio_items"].find({}):
        updates: dict[str, Any] = {}
        user_ref = canonical_user_ref(doc.get("user_id"), valid_user_ids)
        if user_ref != doc.get("user_id"):
            updates["user_id"] = user_ref
        normalized_skills = canonical_existing_refs(doc.get("skill_ids") or [], valid_skill_ids)
        if normalized_skills != list(doc.get("skill_ids") or []):
            updates["skill_ids"] = normalized_skills
            stats["portfolio_item_skill_ids_normalized"] += 1
        if updates:
            stats["portfolio_item_docs_changed"] += 1
            if apply:
                db["portfolio_items"].update_one({"_id": doc["_id"]}, {"$set": updates})
    return stats


def backfill_project_links(db, apply: bool, valid_skill_ids: set[str]) -> Counter:
    stats = Counter()
    existing_links = {
        (oid_str(doc.get("project_id")), oid_str(doc.get("skill_id")))
        for doc in db["project_skill_links"].find({}, {"project_id": 1, "skill_id": 1})
    }
    for project in db["projects"].find({}):
        embedded_skills = canonical_existing_refs(project.get("skill_ids") or [], valid_skill_ids)
        if embedded_skills:
            stats["projects_with_embedded_skill_ids"] += 1
        for skill_oid in embedded_skills:
            key = (oid_str(project.get("_id")), oid_str(skill_oid))
            if key in existing_links:
                continue
            stats["project_links_backfilled"] += 1
            if apply:
                db["project_skill_links"].update_one(
                    {"project_id": project["_id"], "skill_id": skill_oid},
                    {"$setOnInsert": {"project_id": project["_id"], "skill_id": skill_oid, "created_at": project.get("updated_at") or project.get("created_at") or now_utc()}},
                    upsert=True,
                )
        if embedded_skills:
            stats["projects_to_unset_skill_ids"] += 1
            if apply:
                db["projects"].update_one({"_id": project["_id"]}, {"$unset": {"skill_ids": ""}})
    return stats


def normalize_job_ingests(db, apply: bool, valid_skill_ids: set[str], valid_user_ids: set[str]) -> Counter:
    stats = Counter()
    for doc in db["job_ingests"].find({}):
        updates: dict[str, Any] = {}
        user_ref = canonical_user_ref(doc.get("user_id"), valid_user_ids)
        if user_ref != doc.get("user_id"):
            updates["user_id"] = user_ref
        normalized_extracted = normalize_extracted_skills(doc.get("extracted_skills") or [])
        normalized_extracted = [
            entry
            for entry in normalized_extracted
            if oid_str(entry.get("skill_id")) in valid_skill_ids
        ]
        if normalized_extracted != list(doc.get("extracted_skills") or []):
            updates["extracted_skills"] = normalized_extracted
            stats["job_ingest_skill_rows_normalized"] += 1
        keywords = unique_strings(doc.get("keywords") or [])
        if keywords != list(doc.get("keywords") or []):
            updates["keywords"] = keywords
        if updates:
            stats["job_ingest_docs_changed"] += 1
            if apply:
                db["job_ingests"].update_one({"_id": doc["_id"]}, {"$set": updates})
    return stats


def normalize_jobs(
    db,
    apply: bool,
    valid_skill_ids: set[str],
    valid_role_ids: set[str],
    valid_user_ids: set[str],
    valid_job_ingest_ids: set[str],
) -> Counter:
    stats = Counter()
    ingests_by_id = {
        oid_str(doc.get("_id")): doc
        for doc in db["job_ingests"].find({}, {"title": 1, "company": 1, "location": 1, "text": 1, "extracted_skills": 1})
    }
    duplicate_groups = list(
        db["jobs"].aggregate(
            [
                {"$match": {"job_ingest_id": {"$exists": True}}},
                {"$group": {"_id": "$job_ingest_id", "doc_ids": {"$push": "$_id"}, "count": {"$sum": 1}}},
                {"$match": {"count": {"$gt": 1}}},
            ]
        )
    )
    for group in duplicate_groups:
        docs = list(
            db["jobs"].find({"_id": {"$in": group.get("doc_ids") or []}}).sort(
                [("moderation_status", 1), ("updated_at", -1), ("created_at", -1), ("_id", 1)]
            )
        )
        if len(docs) <= 1:
            continue
        keep = docs[0]
        stale_ids = [doc["_id"] for doc in docs[1:]]
        stats["job_duplicate_groups_removed"] += 1
        stats["job_duplicate_docs_removed"] += len(stale_ids)
        if apply:
            db["jobs"].delete_many({"_id": {"$in": stale_ids}})
    for doc in db["jobs"].find({}):
        updates: dict[str, Any] = {}
        submitted_by = canonical_user_ref(doc.get("submitted_by_user_id"), valid_user_ids)
        if submitted_by != doc.get("submitted_by_user_id"):
            updates["submitted_by_user_id"] = submitted_by
        normalized_roles = canonical_existing_refs(doc.get("role_ids") or [], valid_role_ids)
        if normalized_roles != list(doc.get("role_ids") or []):
            updates["role_ids"] = normalized_roles
            stats["job_role_ids_normalized"] += 1

        ingest_ref = canonical_optional_ref(doc.get("job_ingest_id"), valid_job_ingest_ids)
        if ingest_ref != doc.get("job_ingest_id"):
            updates["job_ingest_id"] = ingest_ref
        if ingest_ref is not None:
            ingest_doc = ingests_by_id.get(str(ingest_ref))
            if ingest_doc:
                extracted = [
                    entry
                    for entry in normalize_extracted_skills(ingest_doc.get("extracted_skills") or [])
                    if oid_str(entry.get("skill_id")) in valid_skill_ids
                ]
                required_skills, required_skill_ids = derive_required_skills(extracted)
                preview = " ".join(str(ingest_doc.get("text") or "").split())
                synced_fields = {
                    "title": str(ingest_doc.get("title") or "").strip(),
                    "company": str(ingest_doc.get("company") or "").strip(),
                    "location": str(ingest_doc.get("location") or "").strip(),
                    "description_excerpt": preview[:220] + ("..." if len(preview) > 220 else "") if preview else str(doc.get("description_excerpt") or ""),
                    "description_full": str(ingest_doc.get("text") or "").strip() or doc.get("description_full"),
                    "required_skills": required_skills,
                    "required_skill_ids": required_skill_ids,
                }
                for key, value in synced_fields.items():
                    if value != doc.get(key):
                        updates[key] = value
                        stats[f"jobs_synced_{key}"] += 1
        else:
            normalized_skill_ids = canonical_existing_refs(doc.get("required_skill_ids") or [], valid_skill_ids)
            if normalized_skill_ids != list(doc.get("required_skill_ids") or []):
                updates["required_skill_ids"] = normalized_skill_ids
                stats["jobs_required_skill_ids_normalized"] += 1
            updates["required_skills"] = unique_strings(doc.get("required_skills") or [])

        if updates:
            stats["jobs_docs_changed"] += 1
            if apply:
                db["jobs"].update_one({"_id": doc["_id"]}, {"$set": updates})
    return stats


def normalize_job_match_runs(db, apply: bool, valid_user_ids: set[str], valid_job_ingest_ids: set[str], valid_tailored_ids: set[str]) -> Counter:
    stats = Counter()
    for doc in db["job_match_runs"].find({}):
        updates: dict[str, Any] = {}
        user_ref = canonical_user_ref(doc.get("user_id"), valid_user_ids)
        if user_ref != doc.get("user_id"):
            updates["user_id"] = user_ref
        job_ref = canonical_optional_ref(doc.get("job_id"), valid_job_ingest_ids)
        if job_ref != doc.get("job_id"):
            updates["job_id"] = job_ref
        tailored_ref = canonical_optional_ref(doc.get("tailored_resume_id"), valid_tailored_ids)
        if tailored_ref != doc.get("tailored_resume_id"):
            updates["tailored_resume_id"] = tailored_ref
        if updates:
            stats["job_match_run_docs_changed"] += 1
            if apply:
                db["job_match_runs"].update_one({"_id": doc["_id"]}, {"$set": updates})
    return stats


def normalize_tailored_resumes(db, apply: bool, valid_user_ids: set[str], valid_skill_ids: set[str], valid_job_ingest_ids: set[str], valid_snapshot_ids: set[str], valid_evidence_ids: set[str]) -> Counter:
    stats = Counter()
    for doc in db["tailored_resumes"].find({}):
        updates: dict[str, Any] = {}
        user_ref = canonical_user_ref(doc.get("user_id"), valid_user_ids)
        if user_ref != doc.get("user_id"):
            updates["user_id"] = user_ref
        job_ref = canonical_optional_ref(doc.get("job_id"), valid_job_ingest_ids)
        if job_ref != doc.get("job_id"):
            updates["job_id"] = job_ref
        snapshot_ref = canonical_optional_ref(doc.get("resume_snapshot_id"), valid_snapshot_ids)
        if snapshot_ref != doc.get("resume_snapshot_id"):
            updates["resume_snapshot_id"] = snapshot_ref
        evidence_ref = canonical_optional_ref(doc.get("resume_evidence_id"), valid_evidence_ids)
        if evidence_ref != doc.get("resume_evidence_id"):
            updates["resume_evidence_id"] = evidence_ref
        normalized_skill_ids = canonical_existing_refs(doc.get("selected_skill_ids") or [], valid_skill_ids)
        if normalized_skill_ids != list(doc.get("selected_skill_ids") or []):
            updates["selected_skill_ids"] = normalized_skill_ids
        if updates:
            stats["tailored_resume_docs_changed"] += 1
            if apply:
                db["tailored_resumes"].update_one({"_id": doc["_id"]}, {"$set": updates})
    return stats


def normalize_confirmations(db, apply: bool, valid_user_ids: set[str], valid_skill_ids: set[str], valid_snapshot_ids: set[str]) -> Counter:
    stats = Counter()
    for doc in db["resume_skill_confirmations"].find({}):
        updates: dict[str, Any] = {}
        user_ref = canonical_user_ref(doc.get("user_id"), valid_user_ids)
        if user_ref != doc.get("user_id"):
            updates["user_id"] = user_ref
        snapshot_ref = canonical_optional_ref(doc.get("resume_snapshot_id"), valid_snapshot_ids)
        if snapshot_ref != doc.get("resume_snapshot_id"):
            updates["resume_snapshot_id"] = snapshot_ref

        confirmed = []
        for entry in doc.get("confirmed") or []:
            skill_ref = canonical_optional_ref(entry.get("skill_id"), valid_skill_ids)
            if skill_ref is None:
                continue
            confirmed.append({**entry, "skill_id": skill_ref})
        if confirmed != list(doc.get("confirmed") or []):
            updates["confirmed"] = confirmed

        rejected = []
        for entry in doc.get("rejected") or []:
            skill_ref = canonical_optional_ref(entry.get("skill_id"), valid_skill_ids)
            if skill_ref is None:
                continue
            rejected.append({**entry, "skill_id": skill_ref})
        if rejected != list(doc.get("rejected") or []):
            updates["rejected"] = rejected

        edited = []
        for entry in doc.get("edited") or []:
            skill_ref = canonical_optional_ref(entry.get("to_skill_id"), valid_skill_ids)
            if skill_ref is None:
                continue
            edited.append({**entry, "to_skill_id": skill_ref})
        if edited != list(doc.get("edited") or []):
            updates["edited"] = edited

        if updates:
            stats["confirmation_docs_changed"] += 1
            if apply:
                db["resume_skill_confirmations"].update_one({"_id": doc["_id"]}, {"$set": updates})
    return stats


def normalize_resume_snapshots(db, apply: bool, valid_user_ids: set[str]) -> Counter:
    stats = Counter()
    for doc in db["resume_snapshots"].find({}):
        user_ref = canonical_user_ref(doc.get("user_id"), valid_user_ids)
        if user_ref == doc.get("user_id"):
            continue
        stats["resume_snapshot_docs_changed"] += 1
        if apply:
            db["resume_snapshots"].update_one({"_id": doc["_id"]}, {"$set": {"user_id": user_ref}})
    return stats


def normalize_learning_path_progress(db, apply: bool, valid_user_ids: set[str]) -> Counter:
    stats = Counter()
    latest_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for doc in db["learning_path_progress"].find({}).sort("updated_at", -1):
        user_ref = canonical_user_ref(doc.get("user_id"), valid_user_ids)
        key = (oid_str(user_ref) if isinstance(user_ref, ObjectId) else str(user_ref or "").strip(), str(doc.get("skill_name") or "").strip())
        if key not in latest_by_key:
            latest_by_key[key] = {**doc, "user_id": user_ref}

    keep_ids = {doc["_id"] for doc in latest_by_key.values()}
    for doc in db["learning_path_progress"].find({}):
        if doc["_id"] not in keep_ids:
            stats["learning_path_duplicates_removed"] += 1
            if apply:
                db["learning_path_progress"].delete_one({"_id": doc["_id"]})
            continue
        user_ref = canonical_user_ref(doc.get("user_id"), valid_user_ids)
        if user_ref == doc.get("user_id"):
            continue
        stats["learning_path_docs_changed"] += 1
        if apply:
            db["learning_path_progress"].update_one({"_id": doc["_id"]}, {"$set": {"user_id": user_ref}})
    return stats


def dedupe_skill_relations(db, apply: bool) -> Counter:
    stats = Counter()
    duplicate_groups = list(
        db["skill_relations"].aggregate(
            [
                {
                    "$group": {
                        "_id": {
                            "from_skill_id": "$from_skill_id",
                            "to_skill_id": "$to_skill_id",
                            "relation_type": "$relation_type",
                        },
                        "doc_ids": {"$push": "$_id"},
                        "count": {"$sum": 1},
                    }
                },
                {"$match": {"count": {"$gt": 1}}},
            ]
        )
    )
    for group in duplicate_groups:
        docs = list(
            db["skill_relations"].find({"_id": {"$in": group.get("doc_ids") or []}}).sort(
                [("created_at", 1), ("_id", 1)]
            )
        )
        stale_ids = [doc["_id"] for doc in docs[1:]]
        if not stale_ids:
            continue
        stats["skill_relation_duplicate_groups_removed"] += 1
        stats["skill_relation_duplicate_docs_removed"] += len(stale_ids)
        if apply:
            db["skill_relations"].delete_many({"_id": {"$in": stale_ids}})
    return stats


def run_cleanup(db, apply: bool) -> dict[str, Any]:
    valid_skill_ids = load_existing_ids(db, "skills")
    valid_project_ids = load_existing_ids(db, "projects")
    valid_user_ids = load_existing_ids(db, "users")
    valid_role_ids = load_existing_ids(db, "roles")
    valid_job_ingest_ids = load_existing_ids(db, "job_ingests")
    valid_tailored_ids = load_existing_ids(db, "tailored_resumes")
    valid_snapshot_ids = load_existing_ids(db, "resume_snapshots")
    valid_evidence_ids = load_existing_ids(db, "evidence")

    stats = Counter()
    stats.update(normalize_evidence(db, apply, valid_skill_ids, valid_project_ids, valid_user_ids))
    stats.update(reconcile_portfolio_items(db, apply, valid_skill_ids, valid_user_ids))
    stats.update(backfill_project_links(db, apply, valid_skill_ids))
    stats.update(normalize_job_ingests(db, apply, valid_skill_ids, valid_user_ids))
    valid_job_ingest_ids = load_existing_ids(db, "job_ingests")
    stats.update(normalize_jobs(db, apply, valid_skill_ids, valid_role_ids, valid_user_ids, valid_job_ingest_ids))
    valid_evidence_ids = load_existing_ids(db, "evidence")
    valid_tailored_ids = load_existing_ids(db, "tailored_resumes")
    stats.update(normalize_job_match_runs(db, apply, valid_user_ids, valid_job_ingest_ids, valid_tailored_ids))
    stats.update(normalize_tailored_resumes(db, apply, valid_user_ids, valid_skill_ids, valid_job_ingest_ids, valid_snapshot_ids, valid_evidence_ids))
    stats.update(normalize_confirmations(db, apply, valid_user_ids, valid_skill_ids, valid_snapshot_ids))
    stats.update(normalize_resume_snapshots(db, apply, valid_user_ids))
    stats.update(normalize_learning_path_progress(db, apply, valid_user_ids))
    stats.update(dedupe_skill_relations(db, apply))
    return dict(stats)


def main() -> int:
    args = parse_args()
    uri = args.uri or env_default("MONGO_URI", "mongodb://localhost:27017")
    db_name = args.db or env_default("MONGO_DB", "skillbridge")
    client = MongoClient(uri)
    db = client[db_name]

    report: dict[str, Any] = {
        "mode": "apply" if args.apply else "dry-run",
        "uri": uri,
        "db": db_name,
        "started_at": now_utc().isoformat(),
        "pre_audit": audit_state(db),
    }

    if args.apply:
        backup_dir = Path(args.backup_dir or (Path("backend/data/mongo-backups") / now_utc().strftime("%Y%m%d-%H%M%S")))
        write_backup(db, backup_dir)
        report["backup_dir"] = str(backup_dir)

    report["changes"] = run_cleanup(db, apply=args.apply)
    report["post_audit"] = audit_state(db)
    report["finished_at"] = now_utc().isoformat()

    print(json.dumps(report, indent=2, default=str))
    if args.report_path:
        Path(args.report_path).write_text(json.dumps(report, indent=2, default=str) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
