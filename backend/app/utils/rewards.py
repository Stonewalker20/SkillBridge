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

REWARD_TIER_STEPS: list[dict[str, object]] = [
    {"tier": "bronze", "target_value": 1},
    {"tier": "silver", "target_value": 3},
    {"tier": "gold", "target_value": 5},
    {"tier": "plat", "target_value": 10},
    {"tier": "emerald", "target_value": 25},
    {"tier": "diamond", "target_value": 50},
    {"tier": "master", "target_value": 100},
]

REWARD_BADGES: list[dict[str, object]] = [
    {
        "key": "evidence_saved",
        "icon_key": "spark",
        "counter_key": "evidence_saved",
        "title": "Proof Builder",
        "description": "Save evidence consistently so your profile is grounded in visible proof of work.",
    },
    {
        "key": "profile_skills_confirmed",
        "icon_key": "shield",
        "counter_key": "profile_skills_confirmed",
        "title": "Skill Verifier",
        "description": "Confirm profile skills to turn extracted signals into trusted data for matching and analytics.",
    },
    {
        "key": "resume_snapshots_uploaded",
        "icon_key": "scroll",
        "counter_key": "resume_snapshots_uploaded",
        "title": "Resume Foundation",
        "description": "Add resume sources so tailoring starts from your real materials instead of a blank draft.",
    },
    {
        "key": "job_matches_run",
        "icon_key": "compass",
        "counter_key": "job_matches_run",
        "title": "Match Navigator",
        "description": "Run grounded job matches repeatedly to sharpen fit feedback and gap analysis over time.",
    },
    {
        "key": "tailored_resumes_generated",
        "icon_key": "badge",
        "counter_key": "tailored_resumes_generated",
        "title": "Tailor Forge",
        "description": "Generate tailored resumes so analysis turns into polished, submission-ready artifacts.",
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


def _tier_unlock_key(badge_key: str, tier: str) -> str:
    return f"{badge_key}:{tier}"


def _reward_counter_label(counter_key: str) -> str:
    if counter_key == "evidence_saved":
        return "evidence items"
    if counter_key == "profile_skills_confirmed":
        return "confirmed skills"
    if counter_key == "resume_snapshots_uploaded":
        return "resume sources"
    if counter_key == "job_matches_run":
        return "job matches"
    if counter_key == "tailored_resumes_generated":
        return "tailored resumes"
    return "actions"


def _current_reward_tier(current_value: int) -> str | None:
    current_tier: str | None = None
    for step in REWARD_TIER_STEPS:
        if current_value >= _safe_int(step["target_value"]):
            current_tier = str(step["tier"])
    return current_tier


def _next_reward_tier(current_value: int) -> dict[str, object] | None:
    for step in REWARD_TIER_STEPS:
        if current_value < _safe_int(step["target_value"]):
            return step
    return None


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


def _user_authored_evidence_query(user_refs: list[object], **extra_filters: object) -> dict:
    return {
        "user_id": {"$in": user_refs},
        "$or": [
            {"origin": "user"},
            {"origin": {"$exists": False}},
            {"origin": None},
            {"origin": ""},
        ],
        **extra_filters,
    }


async def _count_profile_confirmed_skills(db, user_refs: list[object]) -> int:
    rows = await (
        db["resume_skill_confirmations"]
        .aggregate(
            [
                {"$match": {"user_id": {"$in": user_refs}, "resume_snapshot_id": {"$in": [None, ""]}}},
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
    resume_evidence_count = await db["evidence"].count_documents(_user_authored_evidence_query(user_refs, type="resume"))
    return resume_snapshot_count + resume_evidence_count


async def calculate_reward_counters(db, user_id: str) -> dict[str, int]:
    user_refs = ref_values(user_id)
    return {
        "evidence_saved": await db["evidence"].count_documents(_user_authored_evidence_query(user_refs)),
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
    for badge in REWARD_BADGES:
        badge_key = str(badge["key"])
        counter_key = str(badge["counter_key"])
        current_value = _safe_int(counters.get(counter_key))
        current_tier = _current_reward_tier(current_value)
        next_tier_step = _next_reward_tier(current_value)
        target_value = _safe_int((next_tier_step or REWARD_TIER_STEPS[-1])["target_value"])
        unlocked = current_tier is not None
        progress_pct = 100.0 if target_value <= 0 else round(min(100.0, (current_value / target_value) * 100.0), 2)
        tier_progress: list[dict] = []
        for step in REWARD_TIER_STEPS:
            tier = str(step["tier"])
            step_target_value = _safe_int(step["target_value"])
            step_unlocked = current_value >= step_target_value
            unlocked_at = unlocked_lookup.get(_tier_unlock_key(badge_key, tier)) if step_unlocked else None
            if step_unlocked and unlocked_at is None:
                unlocked_at = default_unlocked_at
            tier_progress.append(
                {
                    "key": _tier_unlock_key(badge_key, tier),
                    "tier": tier,
                    "target_value": step_target_value,
                    "unlocked": step_unlocked,
                    "unlocked_at": unlocked_at,
                }
            )
        latest_unlocked_at = next(
            (step.get("unlocked_at") for step in reversed(tier_progress) if step.get("unlocked")),
            None,
        )
        next_tier = str(next_tier_step["tier"]) if next_tier_step else None
        if next_tier_step:
            reward = f"Next tier: {next_tier.title()} at {target_value} {_reward_counter_label(counter_key)}."
        else:
            reward = f"Master tier reached at {REWARD_TIER_STEPS[-1]['target_value']} {_reward_counter_label(counter_key)}."
        achievements.append(
            {
                "key": badge_key,
                "icon_key": str(badge.get("icon_key") or "award"),
                "tier": current_tier or "bronze",
                "current_tier": current_tier,
                "next_tier": next_tier,
                "title": str(badge["title"]),
                "description": str(badge["description"]),
                "reward": reward,
                "counter_key": counter_key,
                "current_value": current_value,
                "target_value": target_value,
                "progress_pct": progress_pct,
                "unlocked": unlocked,
                "unlocked_at": latest_unlocked_at,
                "tier_progress": tier_progress,
            }
        )
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
                "key": step["key"],
                "unlocked_at": step.get("unlocked_at"),
                "progress_value": achievement.get("current_value", 0),
            }
            for achievement in achievements
            for step in achievement.get("tier_progress", [])
            if step.get("unlocked")
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
