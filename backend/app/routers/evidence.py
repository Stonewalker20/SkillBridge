from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException, Depends, UploadFile, File, Form
from app.core.auth import require_user
from datetime import datetime, timezone
from app.core.db import get_db
from app.models.evidence import EvidenceIn, EvidenceOut, EvidencePatch
from app.utils.ai import extract_skill_candidates, embed_texts, cosine_similarity
from app.utils.mongo import oid_str, ref_query, ref_values, to_object_id
import io
import os
import re
from hashlib import sha1

router = APIRouter()

TEST_SKILL_PATTERN = re.compile(r"\b(test|demo|sample|mock|dummy|placeholder)\b", re.IGNORECASE)
BAD_SKILL_PATTERN = re.compile(r"(^\d+(\.\d+)?$)|(^\d{4}$)|(^[a-z]{1,2}$)|(\.$)", re.IGNORECASE)
BAD_SKILL_PHRASES = [
    "ability to",
    "equal opportunity",
    "applicants receive",
    "company name",
    "base salary",
    "benefits package",
]
ALLOWED_SHORT_SKILLS = {"c", "c#", "c++", "go", "r", "ui", "ux", "qa", "bi", "ml", "ai"}

def now_utc():
    return datetime.now(timezone.utc)


def is_hidden_skill(doc: dict) -> bool:
    name = (doc.get("name") or "").strip()
    if not name:
        return True
    if doc.get("hidden") is True:
        return True
    low = name.lower()
    if TEST_SKILL_PATTERN.search(name):
        return True
    if low not in ALLOWED_SHORT_SKILLS and BAD_SKILL_PATTERN.search(name):
        return True
    if any(phrase in low for phrase in BAD_SKILL_PHRASES):
        return True
    return False


def serialize_evidence(doc: dict) -> dict:
    return {
        "id": oid_str(doc["_id"]),
        "user_email": doc.get("user_email"),
        "user_id": oid_str(doc.get("user_id")) if doc.get("user_id") is not None else None,
        "type": doc["type"],
        "title": doc["title"],
        "source": doc["source"],
        "text_excerpt": doc["text_excerpt"],
        "skill_ids": [oid_str(x) for x in doc.get("skill_ids", [])],
        "project_id": oid_str(doc.get("project_id")) if doc.get("project_id") is not None else None,
        "tags": doc.get("tags", []),
        "origin": doc.get("origin", "user"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


def extract_text_from_upload(filename: str, raw: bytes) -> str:
    lower = (filename or "").lower()
    if lower.endswith(".pdf"):
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(raw))
        return "\n".join((page.extract_text() or "") for page in reader.pages).strip()
    if lower.endswith(".docx"):
        from docx import Document

        doc = Document(io.BytesIO(raw))
        return "\n".join(p.text for p in doc.paragraphs).strip()
    if lower.endswith(".txt") or lower.endswith(".md"):
        return raw.decode("utf-8", errors="ignore").strip()
    raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, DOCX, or TXT.")


def make_excerpt(text: str, limit: int = 2000) -> str:
    clean = re.sub(r"\s+", " ", (text or "")).strip()
    if len(clean) <= limit:
        return clean
    return clean[: limit - 3] + "..."


def infer_source(url: str | None, filename: str | None) -> str:
    if url and url.strip():
        return url.strip()
    if filename and filename.strip():
        return filename.strip()
    return "manual-entry"


def _candidate_tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{1,}", str(value or "").lower())
        if token not in {"and", "the", "with", "for", "using", "use", "skill", "skills"}
    }


async def _semantic_catalog_match(candidate_name: str, visible_skills: list[dict]) -> tuple[dict | None, str | None]:
    candidate_tokens = _candidate_tokens(candidate_name)
    shortlist: list[tuple[dict, str, float]] = []
    for skill in visible_skills:
        names = [(skill.get("name") or "").strip()]
        names.extend(str(alias or "").strip() for alias in (skill.get("aliases") or []))
        for label in names:
            if not label:
                continue
            label_tokens = _candidate_tokens(label)
            token_overlap = len(candidate_tokens & label_tokens)
            overlap_ratio = token_overlap / max(1, len(candidate_tokens | label_tokens))
            if token_overlap > 0 or candidate_name.lower() in label.lower() or label.lower() in candidate_name.lower():
                shortlist.append((skill, label, overlap_ratio))

    shortlist.sort(key=lambda item: item[2], reverse=True)
    shortlist = shortlist[:20]
    if not shortlist:
        return None, None

    texts = [candidate_name] + [label for _skill, label, _score in shortlist]
    vectors, provider = await embed_texts(texts)
    if len(vectors) != len(texts):
        return None, None

    candidate_vec = vectors[0]
    best_skill = None
    best_score = 0.0
    for (skill, _label, lexical_score), vec in zip(shortlist, vectors[1:]):
        semantic_score = cosine_similarity(candidate_vec, vec)
        combined_score = (semantic_score * 0.8) + (lexical_score * 0.2)
        if combined_score > best_score:
            best_score = combined_score
            best_skill = skill

    if best_skill is None or best_score < 0.42:
        return None, provider
    return best_skill, provider


async def extract_skill_matches(db, text: str) -> list[dict]:
    lowered = (text or "").lower()
    if not lowered:
        return []

    skills = await db["skills"].find({}, {"name": 1, "aliases": 1, "category": 1, "hidden": 1}).to_list(length=5000)
    visible_skills = [skill for skill in skills if not is_hidden_skill(skill)]
    matches: dict[str, dict] = {}

    for skill in visible_skills:
        name = (skill.get("name") or "").strip()
        if not name:
            continue
        sid = oid_str(skill.get("_id"))
        candidates = [(name, "name")] + [((alias or "").strip(), "alias") for alias in (skill.get("aliases") or [])]
        best = None
        for token, matched_on in candidates:
            if not token:
                continue
            pattern = rf"(?<![A-Za-z0-9]){re.escape(token.lower())}(?![A-Za-z0-9])"
            if re.search(pattern, lowered):
                best = matched_on
                break
        if best:
            matches[sid] = {
                "skill_id": sid,
                "skill_name": name,
                "category": skill.get("category", ""),
                "matched_on": best,
                "is_new": False,
            }

    ai_candidates, provider = await extract_skill_candidates(text, max_candidates=25)
    visible_skill_tokens: list[tuple[str, dict]] = []
    for skill in visible_skills:
        name = (skill.get("name") or "").strip()
        if name:
            visible_skill_tokens.append((name.lower(), skill))
        for alias in skill.get("aliases", []) or []:
            alias_text = (alias or "").strip()
            if alias_text:
                visible_skill_tokens.append((alias_text.lower(), skill))

    for candidate in ai_candidates:
        candidate_name = str(candidate.get("name") or "").strip()
        if not candidate_name:
            continue
        candidate_key = candidate_name.lower()
        matched_skill = None
        matched_on = None
        for token, skill in visible_skill_tokens:
            if candidate_key == token:
                matched_skill = skill
                matched_on = "ai-exact"
                break
            if candidate_key in token or token in candidate_key:
                matched_skill = skill
                matched_on = "ai-semantic"
                break
        if matched_skill is None:
            matched_skill, provider = await _semantic_catalog_match(candidate_name, visible_skills)
            if matched_skill is not None:
                matched_on = f"ai-transformer:{provider}"
        if matched_skill is not None:
            sid = oid_str(matched_skill.get("_id"))
            if sid not in matches:
                matches[sid] = {
                    "skill_id": sid,
                    "skill_name": matched_skill.get("name", candidate_name),
                    "category": matched_skill.get("category", "") or candidate.get("category", ""),
                    "matched_on": matched_on or "ai-semantic",
                    "is_new": False,
                }
            continue

        synthetic_id = "candidate:" + sha1(candidate_name.lower().encode("utf-8")).hexdigest()[:12]
        matches[synthetic_id] = {
            "skill_id": synthetic_id,
            "skill_name": candidate_name,
            "category": str(candidate.get("category") or "").strip() or "General",
            "matched_on": f"ai-candidate:{provider}",
            "is_new": True,
        }

    return sorted(matches.values(), key=lambda item: (item["skill_name"].lower(), item["skill_id"]))


def build_analysis_item(title: str, evidence_type: str, source: str, text: str, filename: str | None, extracted_skills: list[dict], index: int) -> dict:
    key_source = filename or source or title or str(index)
    analysis_id = f"analysis:{sha1(f'{index}:{key_source}'.encode('utf-8')).hexdigest()[:12]}"
    return {
        "analysis_id": analysis_id,
        "title": title,
        "type": evidence_type,
        "source": source,
        "text_excerpt": make_excerpt(text),
        "filename": filename,
        "extracted_skills": extracted_skills,
    }


@router.post("/analyze")
async def analyze_evidence(
    title: str | None = Form(default=None),
    type: str = Form(default="project"),
    text: str | None = Form(default=None),
    url: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    files: list[UploadFile] | None = File(default=None),
    user=Depends(require_user),
):
    db = get_db()
    upload_list = [upload for upload in (files or []) if upload is not None]
    if file is not None:
        upload_list.append(file)

    items: list[dict] = []
    manual_text = (text or "").strip()
    if manual_text:
        extracted_skills = await extract_skill_matches(db, manual_text)
        resolved_title = (title or "").strip() or "Untitled Evidence"
        items.append(
            build_analysis_item(
                resolved_title,
                type,
                infer_source(url, None),
                manual_text,
                None,
                extracted_skills,
                0,
            )
        )

    for index, upload in enumerate(upload_list, start=len(items)):
        filename = upload.filename or "upload"
        raw = await upload.read()
        if not raw:
            continue
        extracted_text = extract_text_from_upload(filename, raw)
        if len(extracted_text.strip()) < 20:
            continue
        extracted_skills = await extract_skill_matches(db, extracted_text)
        resolved_title = os.path.splitext(filename)[0] or "Untitled Evidence"
        items.append(
            build_analysis_item(
                resolved_title,
                type,
                infer_source(None, filename),
                extracted_text,
                filename,
                extracted_skills,
                index,
            )
        )

    if not items:
        raise HTTPException(status_code=400, detail="Provide at least 20 characters of evidence text or one or more supported files")

    return {
        "items": items,
        "user_id": oid_str(user["_id"]),
    }

@router.get("/", response_model=list[EvidenceOut])
async def list_evidence(
    user_email: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    skill_id: str | None = Query(default=None),
    project_id: str | None = Query(default=None),
    origin: str | None = Query(default=None),
):
    db = get_db()
    q: dict = {}
    if user_email:
        q["user_email"] = user_email
    if user_id:
        q.update(ref_query("user_id", user_id))
    if skill_id:
        q["skill_ids"] = {"$in": ref_values(skill_id)}
    if project_id:
        q.update(ref_query("project_id", project_id))
    if origin:
        q["origin"] = origin

    cursor = db["evidence"].find(
        q,
        {
            "user_email": 1,
            "user_id": 1,
            "type": 1,
            "title": 1,
            "source": 1,
            "text_excerpt": 1,
            "skill_ids": 1,
            "project_id": 1,
            "tags": 1,
            "origin": 1,
            "created_at": 1,
            "updated_at": 1,
        },
    ).sort("created_at", -1)

    docs = await cursor.to_list(length=500)
    return [serialize_evidence(d) for d in docs]

# UC 1.3 – Add evidence artifact and associate it with a skill/project
@router.post("/", response_model=EvidenceOut)
async def create_evidence(payload: EvidenceIn, user=Depends(require_user)):
    db = get_db()

    skill_ids = []
    for sid in payload.skill_ids or []:
        skill_ids.append(to_object_id(sid))

    doc = {
        "user_email": payload.user_email,
        "type": payload.type,
        "title": payload.title,
        "source": payload.source,
        "text_excerpt": payload.text_excerpt,
        "skill_ids": skill_ids,
        "user_id": user["_id"],
        "project_id": to_object_id(payload.project_id) if payload.project_id else None,
        "tags": payload.tags or [],
        "origin": payload.origin or "user",
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }

    res = await db["evidence"].insert_one(doc)

    return EvidenceOut(
        **serialize_evidence({"_id": res.inserted_id, **doc}),
    )


@router.patch("/{evidence_id}", response_model=EvidenceOut)
async def patch_evidence(evidence_id: str, payload: EvidencePatch, user=Depends(require_user)):
    db = get_db()

    try:
        evidence_oid = to_object_id(evidence_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid evidence_id")

    existing = await db["evidence"].find_one({"_id": evidence_oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if oid_str(existing.get("user_id")) != oid_str(user["_id"]):
        raise HTTPException(status_code=403, detail="You do not have access to this evidence")

    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    if "skill_ids" in updates:
        updates["skill_ids"] = [to_object_id(sid) for sid in updates["skill_ids"]]
    if "project_id" in updates:
        updates["project_id"] = to_object_id(updates["project_id"]) if updates["project_id"] else None

    updates["updated_at"] = now_utc()
    await db["evidence"].update_one({"_id": evidence_oid}, {"$set": updates})

    updated = await db["evidence"].find_one({"_id": evidence_oid})
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to load updated evidence")

    return EvidenceOut(**serialize_evidence(updated))


@router.delete("/{evidence_id}")
async def delete_evidence(evidence_id: str, user=Depends(require_user)):
    db = get_db()

    try:
        evidence_oid = to_object_id(evidence_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid evidence_id")

    existing = await db["evidence"].find_one({"_id": evidence_oid}, {"user_id": 1, "title": 1, "skill_ids": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if oid_str(existing.get("user_id")) != oid_str(user["_id"]):
        raise HTTPException(status_code=403, detail="You do not have access to this evidence")

    skill_ids = list(existing.get("skill_ids") or [])
    await db["evidence"].delete_one({"_id": evidence_oid})

    removed_skill_ids: list[str] = []
    if skill_ids:
        remaining_skill_ids = set(
            oid_str(value)
            for value in await db["evidence"].distinct(
                "skill_ids",
                {"user_id": {"$in": ref_values(user["_id"])}, "origin": "user"},
            )
        )
        removable = [sid for sid in skill_ids if oid_str(sid) not in remaining_skill_ids]
        if removable:
            removable_refs: list[object] = []
            for sid in removable:
                removable_refs.extend(ref_values(sid))
            await db["resume_skill_confirmations"].update_many(
                {"user_id": {"$in": ref_values(user["_id"])}},
                {
                    "$pull": {
                        "confirmed": {"skill_id": {"$in": removable_refs}},
                        "rejected": {"skill_id": {"$in": removable_refs}},
                    }
                },
            )
            removed_skill_ids = [oid_str(sid) for sid in removable]

            # If a removed skill is a user-created custom skill with no remaining evidence
            # and no remaining profile confirmation, delete the orphaned skill record too.
            for sid in removable:
                sid_str = oid_str(sid)
                skill_doc = await db["skills"].find_one(
                    {"_id": {"$in": ref_values(sid)}},
                    {"created_by_user_id": 1},
                )
                if not skill_doc:
                    continue
                if oid_str(skill_doc.get("created_by_user_id")) != oid_str(user["_id"]):
                    continue

                still_confirmed = await db["resume_skill_confirmations"].find_one(
                    {
                        "user_id": {"$in": ref_values(user["_id"])},
                        "confirmed.skill_id": {"$in": ref_values(sid)},
                    },
                    {"_id": 1},
                )
                if still_confirmed:
                    continue

                still_in_evidence = await db["evidence"].find_one(
                    {
                        "user_id": {"$in": ref_values(user["_id"])},
                        "skill_ids": {"$in": ref_values(sid)},
                    },
                    {"_id": 1},
                )
                if still_in_evidence:
                    continue

                await db["skills"].delete_one({"_id": {"$in": ref_values(sid)}})

    return {
        "ok": True,
        "id": evidence_id,
        "title": existing.get("title", "Evidence"),
        "removed_skill_ids": removed_skill_ids,
    }
