"""Authentication routes for account creation, login, profile updates, logout, and account deletion."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from bson import ObjectId
from pathlib import Path
import secrets

from app.core.db import get_db
from app.core.auth import (
    hash_password,
    verify_password,
    create_session,
    require_user,
    now_utc,
)
from app.models.auth import RegisterIn, LoginIn, AuthOut, UserOut, UserPatch, PasswordChangeIn
from app.utils.mongo import oid_str
from app.core.config import settings

router = APIRouter()
AVATAR_PRESETS = {
    "midnight",
    "sunset",
    "mint",
    "ember",
    "violet",
    "slate",
    "ocean",
    "sunrise",
    "forest",
    "rosewood",
    "cobalt",
    "aurora",
    "sandstone",
    "orchid",
}
ALLOWED_AVATAR_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


def serialize_user_out(user: dict) -> UserOut:
    return UserOut(
        id=oid_str(user["_id"]),
        email=user["email"],
        username=user["username"],
        role=user.get("role", "user"),
        avatar_url=str(user.get("avatar_url") or "").strip() or None,
        avatar_preset=str(user.get("avatar_preset") or "").strip() or None,
    )


def _password_parts_for_user(user: dict) -> tuple[str | None, str | None]:
    password_salt = user.get("password_salt")
    password_hash = user.get("password_hash")
    if isinstance(password_hash, dict):
        password_salt = password_hash.get("salt")
        password_hash = password_hash.get("hash")
    return password_salt, password_hash


def _delete_local_avatar_if_present(user: dict):
    avatar_url = str(user.get("avatar_url") or "").strip()
    if not avatar_url.startswith("/media/avatars/"):
        return
    filename = avatar_url.rsplit("/", 1)[-1]
    target = settings.user_avatar_upload_path / filename
    if target.exists():
        target.unlink()


def bootstrap_role_for_email(email: str) -> str:
    normalized = str(email or "").strip().lower()
    if normalized in settings.admin_owner_emails_set:
        return "owner"
    if normalized in settings.admin_team_emails_set:
        return "team"
    return "user"


def is_user_active(user: dict) -> bool:
    return user.get("is_active", True) is not False

@router.post("/register", response_model=AuthOut)
async def register(payload: RegisterIn):
    db = get_db()

    existing = await db["users"].find_one(
        {"$or": [{"email": payload.email}, {"username": payload.username}]}
    )
    if existing:
        raise HTTPException(status_code=409, detail="User already exists")

    password_parts = hash_password(payload.password)

    doc = {
        "email": payload.email,
        "username": payload.username,
        "password_salt": password_parts["salt"],
        "password_hash": password_parts["hash"],
        "role": bootstrap_role_for_email(payload.email),
        "is_active": True,
        "avatar_preset": "midnight",
        "created_at": now_utc(),
    }

    res = await db["users"].insert_one(doc)

    token = await create_session(res.inserted_id)

    return AuthOut(
        token=token,
        user=serialize_user_out({**doc, "_id": res.inserted_id}),
    )


@router.post("/login", response_model=AuthOut)
async def login(payload: LoginIn):
    db = get_db()

    user = await db["users"].find_one(
        {"$or": [{"email": payload.email}, {"username": payload.email}]}
    )

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not is_user_active(user):
        raise HTTPException(status_code=403, detail="Account deactivated")

    password_salt, password_hash = _password_parts_for_user(user)

    if not password_salt or not password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, password_salt, password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = await create_session(user["_id"])

    return AuthOut(
        token=token,
        user=serialize_user_out(user),
    )


@router.get("/me", response_model=UserOut)
async def me(user=Depends(require_user)):
    return serialize_user_out(user)


@router.patch("/me", response_model=UserOut)
async def patch_me(payload: UserPatch, user=Depends(require_user)):
    db = get_db()

    updates = payload.model_dump(exclude_none=True)
    if "avatar_preset" in updates:
        avatar_preset = str(updates["avatar_preset"] or "").strip().lower()
        if avatar_preset and avatar_preset not in AVATAR_PRESETS:
            raise HTTPException(status_code=400, detail="Invalid avatar preset")
        updates["avatar_preset"] = avatar_preset or None
        if avatar_preset:
            _delete_local_avatar_if_present(user)
            updates["avatar_url"] = None

    if updates:
        updates["updated_at"] = now_utc()
        await db["users"].update_one(
            {"_id": user["_id"]},
            {"$set": updates},
        )

    updated = await db["users"].find_one({"_id": user["_id"]})
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")

    return serialize_user_out(updated)


@router.post("/me/password", response_model=AuthOut)
async def change_password(payload: PasswordChangeIn, user=Depends(require_user)):
    password_salt, password_hash = _password_parts_for_user(user)
    if not password_salt or not password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.current_password, password_salt, password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if secrets.compare_digest(payload.current_password, payload.new_password):
        raise HTTPException(status_code=400, detail="New password must be different")

    db = get_db()
    changed_at = now_utc()
    password_parts = hash_password(payload.new_password)
    await db["users"].update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_salt": password_parts["salt"],
                "password_hash": password_parts["hash"],
                "password_changed_at": changed_at,
                "updated_at": changed_at,
            }
        },
    )
    await db["sessions"].delete_many({"user_id": user["_id"]})
    token = await create_session(user["_id"])

    updated = await db["users"].find_one({"_id": user["_id"]})
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")

    return AuthOut(token=token, user=serialize_user_out(updated))


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(file: UploadFile = File(...), user=Depends(require_user)):
    filename = str(file.filename or "").strip()
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_AVATAR_SUFFIXES:
        raise HTTPException(status_code=400, detail="Unsupported avatar file type")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Avatar file is empty")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Avatar file is too large")

    target_name = f"{oid_str(user['_id'])}-{int(now_utc().timestamp() * 1000)}-{secrets.token_hex(4)}{suffix}"
    target = settings.user_avatar_upload_path / target_name
    _delete_local_avatar_if_present(user)
    target.write_bytes(content)

    db = get_db()
    await db["users"].update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "avatar_url": f"/media/avatars/{target_name}",
                "avatar_preset": None,
                "updated_at": now_utc(),
            }
        },
    )
    updated = await db["users"].find_one({"_id": user["_id"]})
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_user_out(updated)


@router.delete("/me")
async def delete_me(user=Depends(require_user)):
    db = get_db()

    await db["users"].delete_one({"_id": user["_id"]})
    await db["sessions"].delete_many({"user_id": user["_id"]})

    return {"ok": True}


@router.post("/logout")
async def logout(user=Depends(require_user)):
    db = get_db()
    await db["sessions"].delete_many({"user_id": user["_id"]})
    return {"ok": True}
