from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId

from app.core.db import get_db
from app.core.auth import (
    hash_password,
    verify_password,
    create_session,
    require_user,
    now_utc,
)
from app.models.auth import RegisterIn, LoginIn, AuthOut, UserOut, UserPatch
from app.utils.mongo import oid_str
from app.core.config import settings

router = APIRouter()


def bootstrap_role_for_email(email: str) -> str:
    normalized = str(email or "").strip().lower()
    if normalized in settings.admin_owner_emails_set:
        return "owner"
    if normalized in settings.admin_team_emails_set:
        return "team"
    return "user"

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
        "created_at": now_utc(),
    }

    res = await db["users"].insert_one(doc)

    token = await create_session(res.inserted_id)

    return AuthOut(
        token=token,
        user=UserOut(
            id=oid_str(res.inserted_id),
            email=doc["email"],
            username=doc["username"],
            role=doc["role"],
        ),
    )


@router.post("/login", response_model=AuthOut)
async def login(payload: LoginIn):
    db = get_db()

    user = await db["users"].find_one(
        {"$or": [{"email": payload.email}, {"username": payload.email}]}
    )

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    password_salt = user.get("password_salt")
    password_hash = user.get("password_hash")

    if isinstance(password_hash, dict):
        password_salt = password_hash.get("salt")
        password_hash = password_hash.get("hash")

    if not password_salt or not password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, password_salt, password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = await create_session(user["_id"])

    return AuthOut(
        token=token,
        user=UserOut(
            id=oid_str(user["_id"]),
            email=user["email"],
            username=user["username"],
            role=user.get("role", "user"),
        ),
    )


@router.get("/me", response_model=UserOut)
async def me(user=Depends(require_user)):
    return UserOut(
        id=oid_str(user["_id"]),
        email=user["email"],
        username=user["username"],
        role=user.get("role", "user"),
    )


@router.patch("/me", response_model=UserOut)
async def patch_me(payload: UserPatch, user=Depends(require_user)):
    db = get_db()

    updates = payload.model_dump(exclude_none=True)

    if "password" in updates:
        password_parts = hash_password(updates.pop("password"))
        updates["password_salt"] = password_parts["salt"]
        updates["password_hash"] = password_parts["hash"]

    if updates:
        await db["users"].update_one(
            {"_id": user["_id"]},
            {"$set": updates},
        )

    updated = await db["users"].find_one({"_id": user["_id"]})

    return UserOut(
        id=oid_str(updated["_id"]),
        email=updated["email"],
        username=updated["username"],
        role=updated.get("role", "user"),
    )


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
