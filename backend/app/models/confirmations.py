from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ConfirmedSkillEntry(BaseModel):
    skill_id: str
    skill_name: str = ""
    proficiency: int = Field(default=0, ge=0, le=5)
    manual_proficiency: int = Field(default=0, ge=0, le=5)
    auto_proficiency: int = Field(default=0, ge=0, le=5)
    evidence_count: int = Field(default=0, ge=0)


class RejectedSkill(BaseModel):
    skill_id: str
    skill_name: str = ""


class EditedSkill(BaseModel):
    from_text: str
    to_skill_id: str


class ConfirmationIn(BaseModel):
    user_id: Optional[str] = None
    resume_snapshot_id: Optional[str] = None
    confirmed: List[ConfirmedSkillEntry] = Field(default_factory=list)
    rejected: List[RejectedSkill] = Field(default_factory=list)
    edited: List[EditedSkill] = Field(default_factory=list)


class ConfirmationOut(BaseModel):
    id: Optional[str] = None
    user_id: Optional[str] = None
    resume_snapshot_id: Optional[str] = None
    confirmed: List[ConfirmedSkillEntry] = Field(default_factory=list)
    rejected: List[RejectedSkill] = Field(default_factory=list)
    edited: List[EditedSkill] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
