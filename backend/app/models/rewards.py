"""Pydantic schemas for user reward counters, achievements, and summary responses."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class RewardCountersOut(BaseModel):
    evidence_saved: int = 0
    profile_skills_confirmed: int = 0
    resume_snapshots_uploaded: int = 0
    job_matches_run: int = 0
    tailored_resumes_generated: int = 0


class RewardAchievementOut(BaseModel):
    key: str
    icon_key: str = "award"
    tier: str = "bronze"
    title: str
    description: str
    reward: str
    counter_key: str
    current_value: int = 0
    target_value: int = 0
    progress_pct: float = 0.0
    unlocked: bool = False
    unlocked_at: datetime | None = None


class RewardBadgeOut(RewardAchievementOut):
    pass


class RewardsSummaryOut(BaseModel):
    counters: RewardCountersOut
    unlocked_count: int = 0
    total_count: int = 0
    badge_count: int = 0
    unlocked_badge_count: int = 0
    achievements: list[RewardAchievementOut] = Field(default_factory=list)
    badges: list[RewardBadgeOut] = Field(default_factory=list)
    next_achievement: RewardAchievementOut | None = None
    recent_unlocks: list[RewardAchievementOut] = Field(default_factory=list)
