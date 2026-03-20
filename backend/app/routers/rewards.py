"""Reward summary routes that expose user milestones and progression counters."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.auth import require_user
from app.core.db import get_db
from app.models.rewards import RewardAchievementOut, RewardCountersOut, RewardsSummaryOut
from app.utils.mongo import oid_str
from app.utils.rewards import build_reward_achievements, get_or_create_reward_doc, normalize_reward_counters, normalize_unlock_records

router = APIRouter()


@router.get("/summary", response_model=RewardsSummaryOut)
async def rewards_summary(user=Depends(require_user)):
    db = get_db()
    doc = await get_or_create_reward_doc(db, oid_str(user["_id"]))
    counters = normalize_reward_counters((doc or {}).get("counters"))
    unlocked_lookup = {
        entry["key"]: entry.get("unlocked_at")
        for entry in normalize_unlock_records((doc or {}).get("unlocked"))
    }
    achievements = [RewardAchievementOut(**achievement) for achievement in build_reward_achievements(counters, unlocked_lookup=unlocked_lookup)]
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
    return RewardsSummaryOut(
        counters=RewardCountersOut(**counters),
        unlocked_count=sum(1 for achievement in achievements if achievement.unlocked),
        total_count=len(achievements),
        achievements=achievements,
        next_achievement=next_achievement,
        recent_unlocks=recent_unlocks[:3],
    )
