from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from bson import ObjectId
from app.core.db import get_db
from app.core.auth import require_user
from app.utils.mongo import oid_str, ref_values

router = APIRouter()

# UC 1.4 – Dashboard Summary (user-specific)
@router.get("/summary")
async def dashboard_summary(
    user=Depends(require_user),
    top_n: int = Query(default=8, ge=1, le=50),
):
    db = get_db()

    # ✅ Correct user id handling
    user_oid: ObjectId = user["_id"]
    user_id_str = oid_str(user_oid)
    user_refs = [user_oid, user_id_str]

    # Recent projects
    projects = await (
        db["projects"]
        .find({"user_id": {"$in": user_refs}}, {"title": 1, "description": 1, "created_at": 1})
        .sort("created_at", -1)
        .limit(10)
        .to_list(length=10)
    )
    proj_out = [
        {"id": oid_str(p["_id"]), "title": p.get("title", ""), "created_at": p.get("created_at")}
        for p in projects
    ]

    recent_activity: list[dict] = []

    recent_project_docs = await (
        db["projects"]
        .find({"user_id": {"$in": user_refs}}, {"title": 1, "created_at": 1, "updated_at": 1})
        .sort("updated_at", -1)
        .limit(10)
        .to_list(length=10)
    )
    for project in recent_project_docs:
        stamp = project.get("updated_at") or project.get("created_at")
        recent_activity.append(
            {
                "id": f"project:{oid_str(project['_id'])}",
                "type": "project",
                "action": "updated" if project.get("updated_at") and project.get("updated_at") != project.get("created_at") else "created",
                "name": project.get("title", "Project"),
                "date": stamp,
            }
        )

    recent_evidence_docs = await (
        db["evidence"]
        .find(
            {"user_id": {"$in": user_refs}, "origin": "user"},
            {"title": 1, "type": 1, "created_at": 1, "updated_at": 1},
        )
        .sort("updated_at", -1)
        .limit(10)
        .to_list(length=10)
    )
    for evidence in recent_evidence_docs:
        stamp = evidence.get("updated_at") or evidence.get("created_at")
        recent_activity.append(
            {
                "id": f"evidence:{oid_str(evidence['_id'])}",
                "type": evidence.get("type", "evidence"),
                "action": "updated" if evidence.get("updated_at") and evidence.get("updated_at") != evidence.get("created_at") else "added",
                "name": evidence.get("title", "Evidence"),
                "date": stamp,
            }
        )

    recent_activity = sorted(
        [item for item in recent_activity if item.get("date")],
        key=lambda item: item["date"],
        reverse=True,
    )[:6]

    # Evidence counts per skill (via evidence.skill_ids)
    # This expects evidence.skill_ids are strings of ObjectIds.
    top_skills = []
    rows = await (
        db["evidence"]
        .aggregate(
            [
                {"$match": {"user_id": {"$in": user_refs}}},
                {"$unwind": {"path": "$skill_ids", "preserveNullAndEmptyArrays": False}},
                {"$group": {"_id": "$skill_ids", "evidence_count": {"$sum": 1}}},
                {"$sort": {"evidence_count": -1}},
                {"$limit": top_n},
            ]
        )
        .to_list(length=top_n)
    )
    for r in rows:
        sid = r.get("_id")
        skill = await db["skills"].find_one({"_id": {"$in": ref_values(sid)}}, {"name": 1, "category": 1})
        top_skills.append(
            {
                "skill_id": oid_str(sid),
                "skill_name": (skill or {}).get("name", ""),
                "category": (skill or {}).get("category", ""),
                "evidence_count": int(r.get("evidence_count", 0)),
            }
        )

    # ✅ Count confirmed skills correctly (counts entries, not documents)
    # This counts ALL confirmed skills across all confirmations for the user.
    # If you only want profile (resume_snapshot_id == null), I’ll show that variant below.
    # ✅ Count confirmed skills for PROFILE ONLY (resume_snapshot_id == None)
    confirmed_count_rows = await (
        db["resume_skill_confirmations"]
        .aggregate(
            [
                {"$match": {"user_id": {"$in": user_refs}, "resume_snapshot_id": None}},
                {"$unwind": {"path": "$confirmed", "preserveNullAndEmptyArrays": False}},
                {"$group": {"_id": "$confirmed.skill_id"}},
                {"$count": "n"},
            ]
        )
        .to_list(length=1)
    )
    confirmed_skills = int((confirmed_count_rows[0]["n"] if confirmed_count_rows else 0))

    totals = {
        "projects": await db["projects"].count_documents({"user_id": {"$in": user_refs}}),
        "evidence": await db["evidence"].count_documents({"user_id": {"$in": user_refs}}),
        "confirmed_skills": confirmed_skills,
    }

    match_score_rows = await (
        db["job_match_runs"]
        .aggregate(
            [
                {"$match": {"user_id": {"$in": user_refs}}},
                {"$group": {"_id": None, "avg_match_score": {"$avg": "$analysis.match_score"}}},
            ]
        )
        .to_list(length=1)
    )
    average_match_score = round(float((match_score_rows[0] or {}).get("avg_match_score", 0) or 0), 2) if match_score_rows else 0.0
    tailored_resumes = await db["tailored_resumes"].count_documents({"user_id": {"$in": user_refs}})

    return {
        "user_id": user_id_str,
        "totals": totals,
        "average_match_score": average_match_score,
        "tailored_resumes": tailored_resumes,
        "recent_projects": proj_out,
        "recent_activity": recent_activity,
        "top_skills_by_evidence": top_skills,
    }
