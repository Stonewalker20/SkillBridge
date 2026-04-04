"""Schemas for user-submitted help requests and admin review actions."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

HelpRequestStatus = Literal["open", "in_review", "resolved"]


class HelpRequestIn(BaseModel):
    category: str = Field(..., min_length=2, max_length=80)
    subject: str = Field(..., min_length=4, max_length=160)
    message: str = Field(..., min_length=20, max_length=4000)
    page: str | None = Field(default=None, max_length=200)


class HelpRequestOut(BaseModel):
    id: str
    user_id: str
    category: str
    subject: str
    message: str
    page: str | None = None
    status: HelpRequestStatus = "open"
    admin_response: str | None = None
    user_has_unread_response: bool = False
    admin_responded_at: datetime | None = None
    user_acknowledged_response_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class HelpRequestAdminPatchIn(BaseModel):
    status: HelpRequestStatus
    admin_response: str | None = Field(default=None, max_length=2000)
