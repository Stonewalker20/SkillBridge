"""Pydantic schemas for authentication requests and authenticated user responses."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

class RegisterIn(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOnboardingOut(BaseModel):
    started_at: Optional[datetime] = None
    last_step: Optional[str] = None
    completed_steps: list[str] = Field(default_factory=list)
    completed_at: Optional[datetime] = None
    dismissed_at: Optional[datetime] = None


class UserOut(BaseModel):
    id: str
    email: EmailStr
    username: str
    role: str = "user"
    avatar_url: Optional[str] = None
    avatar_preset: Optional[str] = None
    subscription_status: str = "inactive"
    subscription_plan: Optional[str] = None
    subscription_started_at: Optional[datetime] = None
    subscription_renewal_at: Optional[datetime] = None
    billing_provider: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    stripe_checkout_session_id: Optional[str] = None
    help_unread_response_count: int = 0
    is_new_user: bool = False
    onboarding: Optional[UserOnboardingOut] = None

class AuthOut(BaseModel):
    token: str
    user: UserOut

class UserPatch(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(default=None, min_length=2, max_length=50)
    avatar_preset: Optional[str] = None


class UserOnboardingPatchIn(BaseModel):
    started_at: Optional[datetime] = None
    last_step: Optional[str] = Field(default=None, min_length=1, max_length=120)
    completed_steps: Optional[list[str]] = None
    completed_at: Optional[datetime] = None
    dismissed_at: Optional[datetime] = None


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetConfirmIn(BaseModel):
    token: str = Field(min_length=16, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetOut(BaseModel):
    ok: bool = True
    message: str
    reset_url: Optional[str] = None


class SubscriptionActivateIn(BaseModel):
    plan: Optional[str] = None
