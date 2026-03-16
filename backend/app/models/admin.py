"""Pydantic schemas that shape admin dashboard responses and role update payloads."""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class AdminUserOut(BaseModel):
    id: str
    email: str
    username: str
    role: str = "user"
    is_active: bool = True
    created_at: datetime | None = None
    deactivated_at: datetime | None = None


class AdminUserRolePatch(BaseModel):
    role: str = Field(..., min_length=1)


class AdminJobOut(BaseModel):
    id: str
    title: str
    company: str
    location: str
    source: str
    description_excerpt: str
    moderation_status: str
    moderation_reason: str | None = None
    role_ids: list[str] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AdminSummaryOut(BaseModel):
    total_users: int
    team_members: int
    projects: int
    evidence: int
    jobs: int
    pending_jobs: int
    skills: int
    tailored_resumes: int
    provider_mode: str
    collections: dict[str, int] = Field(default_factory=dict)
