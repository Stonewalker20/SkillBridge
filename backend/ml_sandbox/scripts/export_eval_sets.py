"""Export anonymized ML evaluation datasets from live SkillBridge Mongo data."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient


ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings  # noqa: E402
from ml_sandbox.eval_export import build_export_bundle, write_export_bundle  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mongo-uri", default=settings.mongo_uri)
    parser.add_argument("--mongo-db", default=settings.mongo_db)
    parser.add_argument(
        "--output-dir",
        default="",
        help="Target directory for the generated JSONL files. Defaults to backend/ml_sandbox/datasets/generated/<timestamp>/",
    )
    parser.add_argument(
        "--anon-salt",
        default="",
        help="HMAC salt used for deterministic pseudonyms. Prefer passing it by env var instead of shell history.",
    )
    parser.add_argument(
        "--anon-salt-env",
        default="ML_SANDBOX_ANON_SALT",
        help="Environment variable to read the anonymization salt from when --anon-salt is omitted.",
    )
    parser.add_argument("--max-users", type=int, default=200)
    parser.add_argument("--max-per-user", type=int, default=8)
    parser.add_argument("--negative-count", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def _anon_salt(args: argparse.Namespace) -> str:
    if args.anon_salt:
        return args.anon_salt
    value = os.getenv(args.anon_salt_env, "").strip()
    if value:
        return value
    raise SystemExit(
        "Missing anonymization salt. Set --anon-salt or export "
        f"{args.anon_salt_env}=... before running this exporter."
    )


def _default_output_dir() -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return ROOT / "backend" / "ml_sandbox" / "datasets" / "generated" / stamp


async def _fetch_users(db, max_users: int) -> list[dict]:
    docs = await (
        db["users"]
        .find({"$or": [{"is_active": {"$ne": False}}, {"is_active": {"$exists": False}}]}, {"email": 1, "username": 1, "name": 1, "full_name": 1, "created_at": 1})
        .sort("created_at", -1)
        .limit(max_users)
        .to_list(length=max_users)
    )
    return docs


def _user_filter(user_ids: list[object]) -> dict:
    object_ids = [user_id for user_id in user_ids if user_id is not None]
    strings = [str(user_id) for user_id in object_ids]
    return {"$or": [{"user_id": {"$in": object_ids}}, {"user_id": {"$in": strings}}]}


async def _fetch_bundle_inputs(db, max_users: int) -> dict[str, list[dict]]:
    users = await _fetch_users(db, max_users=max_users)
    user_ids = [user.get("_id") for user in users]
    scoped_filter = _user_filter(user_ids)
    payload = {
        "users": users,
        "skills": await db["skills"].find({}, {"name": 1, "skill_name": 1}).to_list(length=5000),
        "evidence_docs": await db["evidence"].find(scoped_filter, {"user_id": 1, "type": 1, "summary": 1, "text_excerpt": 1, "bullets": 1, "skill_ids": 1, "origin": 1, "created_at": 1, "updated_at": 1}).to_list(length=5000),
        "resume_snapshots": await db["resume_snapshots"].find(scoped_filter, {"user_id": 1, "source_type": 1, "raw_text": 1, "created_at": 1}).to_list(length=3000),
        "confirmations": await db["resume_skill_confirmations"].find(scoped_filter, {"user_id": 1, "resume_snapshot_id": 1, "confirmed": 1, "created_at": 1, "updated_at": 1}).to_list(length=5000),
        "job_match_runs": await db["job_match_runs"].find(scoped_filter, {"user_id": 1, "job_text_snapshot": 1, "text_preview": 1, "analysis.retrieved_context": 1, "created_at": 1, "updated_at": 1}).to_list(length=5000),
        "tailored_resumes": await db["tailored_resumes"].find(scoped_filter, {"user_id": 1, "job_id": 1, "job_text": 1, "selected_skill_ids": 1, "selected_item_ids": 1, "retrieved_context": 1, "sections": 1, "rewrite_focus": 1, "template_source": 1, "created_at": 1, "updated_at": 1}).to_list(length=5000),
        "job_ingests": await db["job_ingests"].find(scoped_filter, {"keywords": 1, "text": 1}).to_list(length=5000),
    }
    return payload


async def _run(args: argparse.Namespace) -> int:
    anon_salt = _anon_salt(args)
    output_dir = Path(args.output_dir).expanduser() if args.output_dir else _default_output_dir()
    client = AsyncIOMotorClient(args.mongo_uri)
    try:
        db = client[args.mongo_db]
        inputs = await _fetch_bundle_inputs(db, max_users=args.max_users)
    finally:
        client.close()

    bundle = build_export_bundle(
        **inputs,
        anon_salt=anon_salt,
        max_per_user=args.max_per_user,
        negative_count=args.negative_count,
    )
    if args.dry_run:
        print(json.dumps({"output_dir": str(output_dir), **bundle.manifest}, indent=2, sort_keys=True))
        return 0

    paths = write_export_bundle(bundle, output_dir)
    print(
        json.dumps(
            {
                "output_dir": str(output_dir),
                "files": {name: str(path) for name, path in paths.items()},
                "counts": bundle.manifest["counts"],
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def main() -> int:
    return asyncio.run(_run(parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
