"""Populate a synthetic Mongo dataset for the ML sandbox from local seed files."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient


ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings  # noqa: E402
from ml_sandbox.seed_builder import build_seed_documents, load_seed_sources  # noqa: E402


SEEDED_COLLECTIONS = (
    "users",
    "skills",
    "evidence",
    "resume_snapshots",
    "resume_skill_confirmations",
    "job_ingests",
    "job_match_runs",
    "tailored_resumes",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mongo-uri", default=settings.mongo_uri)
    parser.add_argument("--mongo-db", default="skillbridge_ml_seed")
    parser.add_argument("--seed-dir", default=str(ROOT / "backend" / "data" / "seed"))
    parser.add_argument("--seed-namespace", default="ml-sandbox-seed")
    parser.add_argument("--max-resume-rows", type=int, default=12)
    parser.add_argument("--max-external-postings", type=int, default=12)
    parser.add_argument("--max-large-linkedin-jobs", type=int, default=12)
    parser.add_argument("--max-nyc-jobs", type=int, default=12)
    parser.add_argument("--max-jobs-per-user", type=int, default=2)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


async def _purge_namespace(db, seed_namespace: str) -> None:
    for collection_name in SEEDED_COLLECTIONS:
        await db[collection_name].delete_many({"seed_namespace": seed_namespace})


async def _insert_documents(db, docs_by_collection: dict[str, list[dict]]) -> None:
    for collection_name in SEEDED_COLLECTIONS:
        docs = docs_by_collection.get(collection_name) or []
        if docs:
            await db[collection_name].insert_many(docs)


async def _run(args: argparse.Namespace) -> int:
    seed_sources = load_seed_sources(
        args.seed_dir,
        max_resume_rows=args.max_resume_rows,
        max_external_postings=args.max_external_postings,
        max_large_linkedin_jobs=args.max_large_linkedin_jobs,
        max_nyc_jobs=args.max_nyc_jobs,
    )
    docs_by_collection = build_seed_documents(
        seed_sources,
        seed_namespace=args.seed_namespace,
        max_jobs_per_user=args.max_jobs_per_user,
    )
    if args.dry_run:
        print(json.dumps(docs_by_collection["manifest"], indent=2, sort_keys=True))
        return 0

    client = AsyncIOMotorClient(args.mongo_uri)
    try:
        db = client[args.mongo_db]
        await _purge_namespace(db, args.seed_namespace)
        await _insert_documents(db, docs_by_collection)
    finally:
        client.close()

    print(
        json.dumps(
            {
                "mongo_db": args.mongo_db,
                "seed_dir": args.seed_dir,
                "seed_namespace": args.seed_namespace,
                **docs_by_collection["manifest"],
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
