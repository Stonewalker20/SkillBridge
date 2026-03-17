"""Pydantic schemas for authentication requests and authenticated user responses."""

from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class RegisterIn(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class UserOut(BaseModel):
    id: str
    email: EmailStr
    username: str
    role: str = "user"
    avatar_url: Optional[str] = None
    avatar_preset: Optional[str] = None

class AuthOut(BaseModel):
    token: str
    user: UserOut

class UserPatch(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(default=None, min_length=2, max_length=50)
    avatar_preset: Optional[str] = None


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
