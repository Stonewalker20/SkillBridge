"""Reward summary routes that expose user milestones and progression counters."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.auth import require_user
from app.core.db import get_db
from app.models.rewards import RewardAchievementOut, RewardBadgeOut, RewardCountersOut, RewardsSummaryOut
from app.utils.mongo import oid_str
from app.utils.rewards import (
    build_reward_achievements,
    build_reward_badges,
    normalize_reward_counters,
    normalize_unlock_records,
    refresh_reward_doc,
    reward_progress_counts,
)

router = APIRouter()


@router.get("/summary", response_model=RewardsSummaryOut)
async def rewards_summary(user=Depends(require_user)):
    db = get_db()
    doc = await refresh_reward_doc(db, oid_str(user["_id"]))
    counters = normalize_reward_counters((doc or {}).get("counters"))
    unlocked_lookup = {
        entry["key"]: entry.get("unlocked_at")
        for entry in normalize_unlock_records((doc or {}).get("unlocked"))
    }
    achievements = [RewardAchievementOut(**achievement) for achievement in build_reward_achievements(counters, unlocked_lookup=unlocked_lookup)]
    badges = [RewardBadgeOut(**badge) for badge in build_reward_badges([achievement.model_dump() for achievement in achievements])]
    recent_unlock_lookup = {
        entry["key"]: entry.get("unlocked_at")
        for entry in normalize_unlock_records((doc or {}).get("recent_unlocks"))
    }
    recent_unlocks = [achievement for achievement in achievements if achievement.key in recent_unlock_lookup]
    recent_unlocks.sort(
        key=lambda achievement: recent_unlock_lookup.get(achievement.key) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    next_achievement = next((achievement for achievement in achievements if not achievement.unlocked), None)
    progress_counts = reward_progress_counts([achievement.model_dump() for achievement in achievements])
    return RewardsSummaryOut(
        counters=RewardCountersOut(**counters),
        unlocked_count=progress_counts["unlocked_count"],
        total_count=progress_counts["total_count"],
        badge_count=len(badges),
        unlocked_badge_count=sum(1 for badge in badges if badge.unlocked),
        achievements=achievements,
        badges=badges,
        next_achievement=next_achievement,
        recent_unlocks=recent_unlocks[:3],
    )
