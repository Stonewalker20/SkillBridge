"""Pydantic schemas for canonical skills, user-created skills, and skill listing responses."""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class SkillIn(BaseModel):
    name: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    aliases: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    proficiency: Optional[int] = None
    last_used_at: Optional[datetime] = None


class SkillOut(BaseModel):
    id: str
    name: str
    category: str
    categories: List[str] = Field(default_factory=list)
    aliases: List[str]
    tags: List[str] = Field(default_factory=list)
    proficiency: Optional[int] = None
    last_used_at: Optional[datetime] = None
    origin: str = "default"
    created_by_user_id: Optional[str] = None
    can_delete: bool = False
    merged_ids: List[str] = Field(default_factory=list)

class SkillUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    category: Optional[str] = Field(default=None, min_length=1)
    aliases: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    proficiency: Optional[int] = Field(default=None, ge=0, le=5)
    last_used_at: Optional[datetime] = None
