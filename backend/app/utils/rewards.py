"""Reward counter, milestone, and summary helpers for user progression features."""

from __future__ import annotations

from datetime import datetime, timezone

from app.utils.mongo import ref_values, to_object_id

REWARD_COUNTER_KEYS = (
    "evidence_saved",
    "profile_skills_confirmed",
    "resume_snapshots_uploaded",
    "job_matches_run",
    "tailored_resumes_generated",
)

REWARD_MILESTONES: list[dict[str, object]] = [
    {
        "key": "first_evidence_saved",
        "counter_key": "evidence_saved",
        "target_value": 1,
        "title": "First Proof Added",
        "description": "Save your first evidence item to start building a verifiable portfolio.",
        "reward": "Unlocked: Evidence Starter badge",
    },
    {
        "key": "evidence_starter",
        "counter_key": "evidence_saved",
        "target_value": 3,
        "title": "Proof Stack",
        "description": "Save three evidence items so your profile starts showing repeatable proof of work.",
        "reward": "Unlocked: Proof Stack badge",
    },
    {
        "key": "first_skill_confirmed",
        "counter_key": "profile_skills_confirmed",
        "target_value": 1,
        "title": "First Skill Locked In",
        "description": "Confirm your first profile skill to turn extracted signals into trusted profile data.",
        "reward": "Unlocked: Skill Claim badge",
    },
    {
        "key": "skill_stack",
        "counter_key": "profile_skills_confirmed",
        "target_value": 5,
        "title": "Skill Stack",
        "description": "Build a profile with five confirmed skills to strengthen job-match reasoning.",
        "reward": "Unlocked: Skill Stack badge",
    },
    {
        "key": "first_resume_uploaded",
        "counter_key": "resume_snapshots_uploaded",
        "target_value": 1,
        "title": "Template Ready",
        "description": "Upload or paste a resume so tailoring starts from your actual baseline materials.",
        "reward": "Unlocked: Resume Template badge",
    },
    {
        "key": "first_job_match",
        "counter_key": "job_matches_run",
        "target_value": 1,
        "title": "First Match Run",
        "description": "Run your first grounded job analysis to unlock targeted fit feedback.",
        "reward": "Unlocked: Match Runner badge",
    },
    {
        "key": "match_momentum",
        "counter_key": "job_matches_run",
        "target_value": 3,
        "title": "Match Momentum",
        "description": "Run three job matches to build a stronger signal about what roles align with your profile.",
        "reward": "Unlocked: Momentum badge",
    },
    {
        "key": "first_tailored_resume",
        "counter_key": "tailored_resumes_generated",
        "target_value": 1,
        "title": "Resume Tailored",
        "description": "Generate your first tailored resume to turn analysis into a submission-ready artifact.",
        "reward": "Unlocked: Tailor Ready badge",
    },
]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def empty_reward_counters() -> dict[str, int]:
    return {key: 0 for key in REWARD_COUNTER_KEYS}


def _safe_int(value: object) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def normalize_reward_counters(raw: dict | None) -> dict[str, int]:
    if not isinstance(raw, dict):
        raw = {}
    counters = empty_reward_counters()
    for key in REWARD_COUNTER_KEYS:
        counters[key] = _safe_int((raw or {}).get(key))
    return counters


def normalize_unlock_records(raw: list[dict] | None) -> list[dict]:
    if not isinstance(raw, list):
        return []
    records: list[dict] = []
    for entry in raw or []:
        if not isinstance(entry, dict):
            continue
        key = str((entry or {}).get("key") or "").strip()
        if not key:
            continue
        records.append(
            {
                "key": key,
                "unlocked_at": (entry or {}).get("unlocked_at"),
                "progress_value": _safe_int((entry or {}).get("progress_value")),
            }
        )
    return records


async def _count_profile_confirmed_skills(db, user_refs: list[object]) -> int:
    rows = await (
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
    return _safe_int((rows[0] or {}).get("n")) if rows else 0


async def _count_resume_sources(db, user_refs: list[object]) -> int:
    resume_snapshot_count = await db["resume_snapshots"].count_documents({"user_id": {"$in": user_refs}})
    resume_evidence_count = await db["evidence"].count_documents(
        {"user_id": {"$in": user_refs}, "origin": "user", "type": "resume"}
    )
    return resume_snapshot_count + resume_evidence_count


async def calculate_reward_counters(db, user_id: str) -> dict[str, int]:
    user_refs = ref_values(user_id)
    return {
        "evidence_saved": await db["evidence"].count_documents({"user_id": {"$in": user_refs}, "origin": "user"}),
        "profile_skills_confirmed": await _count_profile_confirmed_skills(db, user_refs),
        "resume_snapshots_uploaded": await _count_resume_sources(db, user_refs),
        "job_matches_run": await db["job_match_runs"].count_documents({"user_id": {"$in": user_refs}}),
        "tailored_resumes_generated": await db["tailored_resumes"].count_documents({"user_id": {"$in": user_refs}}),
    }


def build_reward_achievements(
    counters: dict[str, int],
    unlocked_lookup: dict[str, object] | None = None,
    default_unlocked_at: datetime | None = None,
) -> list[dict]:
    unlocked_lookup = unlocked_lookup or {}
    default_unlocked_at = default_unlocked_at or now_utc()
    achievements: list[dict] = []
    for milestone in REWARD_MILESTONES:
        counter_key = str(milestone["counter_key"])
        current_value = _safe_int(counters.get(counter_key))
        target_value = _safe_int(milestone["target_value"])
        unlocked = current_value >= target_value
        progress_pct = 100.0 if target_value <= 0 else round(min(100.0, (current_value / target_value) * 100.0), 2)
        achievements.append(
            {
                "key": str(milestone["key"]),
                "title": str(milestone["title"]),
                "description": str(milestone["description"]),
                "reward": str(milestone["reward"]),
                "counter_key": counter_key,
                "current_value": current_value,
                "target_value": target_value,
                "progress_pct": progress_pct,
                "unlocked": unlocked,
                "unlocked_at": unlocked_lookup.get(str(milestone["key"])) if unlocked else None,
            }
        )
        if unlocked and achievements[-1]["unlocked_at"] is None:
            achievements[-1]["unlocked_at"] = default_unlocked_at
    return achievements


def _recent_unlock_records(achievements: list[dict]) -> list[dict]:
    unlocked = [achievement for achievement in achievements if achievement.get("unlocked")]
    unlocked.sort(
        key=lambda achievement: achievement.get("unlocked_at") or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return [
        {
            "key": achievement["key"],
            "unlocked_at": achievement.get("unlocked_at"),
            "progress_value": achievement.get("current_value", 0),
        }
        for achievement in unlocked[:3]
    ]


def reward_progress_counts(achievements: list[dict]) -> dict[str, int]:
    return {
        "total_count": len(achievements),
        "unlocked_count": sum(1 for achievement in achievements if achievement.get("unlocked")),
    }


def build_reward_badges(achievements: list[dict]) -> list[dict]:
    return [dict(achievement) for achievement in achievements]


async def _save_reward_state(db, user_id: str, counters: dict[str, int]) -> dict:
    stored_counters = normalize_reward_counters(counters)
    current = await db["user_rewards"].find_one({"user_id": to_object_id(user_id)})
    unlocked_lookup = {
        entry["key"]: entry.get("unlocked_at")
        for entry in normalize_unlock_records((current or {}).get("unlocked"))
    }
    achievements = build_reward_achievements(stored_counters, unlocked_lookup=unlocked_lookup, default_unlocked_at=now_utc())
    doc = {
        "user_id": to_object_id(user_id),
        "counters": stored_counters,
        "unlocked": [
            {
                "key": achievement["key"],
                "unlocked_at": achievement.get("unlocked_at"),
                "progress_value": achievement.get("current_value", 0),
            }
            for achievement in achievements
            if achievement.get("unlocked")
        ],
        "recent_unlocks": _recent_unlock_records(achievements),
        "updated_at": now_utc(),
    }
    await db["user_rewards"].update_one({"user_id": to_object_id(user_id)}, {"$set": doc}, upsert=True)
    return doc


async def get_or_create_reward_doc(db, user_id: str) -> dict:
    existing = await db["user_rewards"].find_one({"user_id": to_object_id(user_id)})
    if existing:
        normalized_counters = normalize_reward_counters(existing.get("counters"))
        if normalized_counters != existing.get("counters"):
            return await _save_reward_state(db, user_id, normalized_counters)
        return existing
    counters = await calculate_reward_counters(db, user_id)
    return await _save_reward_state(db, user_id, counters)


async def refresh_reward_doc(db, user_id: str) -> dict:
    current = await get_or_create_reward_doc(db, user_id)
    recalculated_counters = await calculate_reward_counters(db, user_id)
    stored_counters = normalize_reward_counters((current or {}).get("counters"))
    if recalculated_counters == stored_counters:
        return current
    return await _save_reward_state(db, user_id, recalculated_counters)


async def increment_reward_counter(db, user_id: str, counter_key: str, amount: int = 1) -> dict:
    if counter_key not in REWARD_COUNTER_KEYS:
        raise ValueError(f"Unsupported reward counter: {counter_key}")
    current = await get_or_create_reward_doc(db, user_id)
    counters = normalize_reward_counters((current or {}).get("counters"))
    counters[counter_key] = _safe_int(counters.get(counter_key)) + max(0, amount)
    return await _save_reward_state(db, user_id, counters)


async def sync_reward_counter(db, user_id: str, counter_key: str, value: int) -> dict:
    if counter_key not in REWARD_COUNTER_KEYS:
        raise ValueError(f"Unsupported reward counter: {counter_key}")
    current = await get_or_create_reward_doc(db, user_id)
    counters = normalize_reward_counters((current or {}).get("counters"))
    counters[counter_key] = _safe_int(value)
    return await _save_reward_state(db, user_id, counters)
