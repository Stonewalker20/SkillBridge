"""Helpers for recomputing cached role weight summaries from approved jobs."""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId

from app.utils.mongo import oid_str, ref_values


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def refresh_role_weights(db, role_id: str) -> list[dict]:
    """Rebuild the cached weight summary for a role from currently approved jobs."""
    role_id = str(role_id or "").strip()
    if not role_id:
        return []

    try:
        role_oid = ObjectId(role_id)
    except Exception:
        return []

    role_doc = await db["roles"].find_one({"_id": role_oid}, {"name": 1})

    jobs = await db["jobs"].find(
        {"moderation_status": "approved", "role_ids": {"$in": ref_values(role_id)}},
        {"required_skill_ids": 1},
    ).to_list(length=2000)

    total = len(jobs)
    if total == 0:
        weights: list[dict] = []
    else:
        counts: dict[str, int] = {}
        for job in jobs:
            job_skill_ids = {
                oid_str(skill_id)
                for skill_id in (job.get("required_skill_ids") or [])
                if oid_str(skill_id)
            }
            for skill_id in job_skill_ids:
                counts[skill_id] = counts.get(skill_id, 0) + 1

        ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        skill_oids = []
        skill_name_map: dict[str, str] = {}
        for skill_id, _count in ranked:
            try:
                skill_oid = ObjectId(skill_id)
            except Exception:
                continue
            skill_oids.append(skill_oid)
            skill_name_map[str(skill_oid)] = ""

        if skill_oids:
            skill_docs = await db["skills"].find({"_id": {"$in": skill_oids}}, {"name": 1}).to_list(length=len(skill_oids))
            for doc in skill_docs:
                skill_name_map[str(doc["_id"])] = str(doc.get("name") or "")

        weights = []
        for skill_id, count in ranked:
            skill_name = ""
            try:
                skill_name = skill_name_map.get(str(ObjectId(skill_id)), "")
            except Exception:
                skill_name = ""
            weights.append(
                {
                    "skill_id": skill_id,
                    "skill_name": skill_name,
                    "weight": count / total,
                }
            )

    doc = {
        "role_id": role_oid,
        "role_name": str((role_doc or {}).get("name") or ""),
        "computed_at": now_utc(),
        "weights": weights,
    }
    await db["role_skill_weights"].update_one({"role_id": role_oid}, {"$set": doc}, upsert=True)
    return weights
