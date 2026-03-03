from __future__ import annotations

import re
import tempfile
from datetime import datetime, timezone
from typing import Iterable

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.db import get_db
from app.models.tailor import (
    AISettingsStatusOut,
    ExtractedSkill,
    JobIngestIn,
    JobIngestOut,
    JobMatchCompareOut,
    JobMatchHistoryDetailOut,
    JobMatchHistoryEntryOut,
    JobMatchOut,
    MatchScoreBreakdown,
    ResumeSection,
    RewriteBulletsIn,
    RewriteBulletsOut,
    TailoredResumeDetailOut,
    TailoredResumeListEntryOut,
    TailoredResumeOut,
    TailorPreviewIn,
)
from app.utils.skill_catalog import merge_skill_docs, normalize_skill_text
from app.utils.ai import cosine_similarity, embed_texts, get_inference_status, rewrite_resume_bullets
from app.utils.mongo import oid_str, ref_query, ref_values, to_object_id

router = APIRouter()

def now_utc():
    return datetime.now(timezone.utc)

def _job_focus_lines(text: str) -> list[tuple[str, float]]:
    section_markers = {
        "required": 3.5,
        "requirements": 3.5,
        "minimum qualifications": 3.5,
        "basic qualifications": 3.5,
        "must have": 3.5,
        "must-have": 3.5,
        "preferred": 2.5,
        "preferred qualifications": 2.5,
        "nice to have": 2.5,
        "nice-to-have": 2.5,
        "responsibilities": 2.25,
        "what you'll do": 2.25,
        "what you will do": 2.25,
        "in this role": 2.0,
        "experience with": 2.0,
    }

    active_weight = 1.0
    lines: list[tuple[str, float]] = []
    for raw_line in (text or "").splitlines():
        line = raw_line.strip(" \t-•*")
        if not line:
            continue
        lower = normalize_skill_text(line)
        matched_weight = next((weight for marker, weight in section_markers.items() if marker in lower), None)
        if matched_weight is not None:
            active_weight = matched_weight
            continue
        weight = active_weight
        if raw_line.lstrip().startswith(("-", "•", "*")):
            weight += 0.5
        if len(line) >= 18:
            lines.append((line, weight))
    return lines

def _normalize_keyword_phrase(value: str) -> str:
    value = normalize_skill_text(value)
    return value.strip(" ,;:/")

def _tokenize_keywords(text: str, extracted: Iterable[ExtractedSkill] | None = None) -> list[str]:
    generic_terms = {
        "experience", "skills", "skill", "requirements", "requirement", "responsibilities",
        "responsibility", "qualified", "qualification", "qualifications", "candidate",
        "candidates", "ability", "abilities", "knowledge", "strong", "excellent", "preferred",
        "required", "role", "team", "work", "working", "environment", "business", "company",
        "position", "opportunity", "including", "ability to", "experience in", "experience with",
    }
    stop_words = {
        "and", "the", "for", "with", "from", "that", "this", "have", "will", "your", "able",
        "must", "plus", "also", "using", "used", "into", "over", "such", "they", "their",
        "them", "than", "then", "only", "when", "where", "what", "were", "been", "being",
        "more", "less", "some", "many", "each", "make", "made", "through", "within", "across",
        "under", "while", "about", "other", "need", "needs", "build", "built",
    }

    phrase_scores: dict[str, float] = {}

    def add_phrase(raw_value: str, weight: float):
        phrase = _normalize_keyword_phrase(raw_value)
        if not phrase or phrase in generic_terms:
            return
        tokens = [token for token in phrase.split() if token not in stop_words]
        if not tokens:
            return
        if len(tokens) == 1 and len(tokens[0]) < 4 and "+" not in tokens[0] and "#" not in tokens[0]:
            return
        candidate = " ".join(tokens[:4])
        if candidate in generic_terms:
            return
        phrase_scores[candidate] = max(phrase_scores.get(candidate, 0.0), 0.0) + weight

    for skill in extracted or []:
        add_phrase(skill.skill_name, 7.0)

    for line, weight in _job_focus_lines(text):
        lower = line.lower()
        for segment in re.split(r"[;,/]|(?:\s+-\s+)", lower):
            segment = segment.strip()
            if not segment:
                continue
            add_phrase(segment, weight)
            words = re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{2,}", segment)
            filtered = [word for word in words if word not in stop_words and word not in generic_terms]
            for word in filtered:
                add_phrase(word, weight * 0.65)
            for i in range(max(0, len(filtered) - 1)):
                add_phrase(" ".join(filtered[i : i + 2]), weight * 0.8)

    scored = sorted(phrase_scores.items(), key=lambda item: (-item[1], -len(item[0]), item[0]))
    return [phrase for phrase, _score in scored[:35]]

def _top_average(scores: Iterable[float], limit: int) -> float:
    positives = [score for score in scores if score > 0]
    if not positives:
        return 0.0
    ranked = sorted(positives, reverse=True)[:limit]
    return sum(ranked) / len(ranked)

def _is_hidden_skill_doc(doc: dict) -> bool:
    name = (doc.get("name") or "").strip().lower()
    if not name:
        return True
    if doc.get("hidden") is True:
        return True
    blocked_terms = ("test", "demo", "sample", "mock", "dummy", "placeholder")
    return any(term in name for term in blocked_terms)

async def _load_skill_catalog(db) -> list[dict]:
    cursor = db["skills"].find({}, {"name": 1, "aliases": 1, "category": 1, "hidden": 1})
    docs = await cursor.to_list(length=5000)
    return merge_skill_docs([doc for doc in docs if not _is_hidden_skill_doc(doc)])

def _match_skills(job_text: str, skills: Iterable[dict]) -> list[ExtractedSkill]:
    text = normalize_skill_text(job_text)
    matches: dict[str, ExtractedSkill] = {}

    def bump(sid: str, name: str, matched_on: str):
        key = sid
        if key not in matches:
            matches[key] = ExtractedSkill(skill_id=sid, skill_name=name, matched_on=matched_on, count=1)
        else:
            matches[key].count += 1

    for s in skills:
        sid = str(s["_id"])
        name = (s.get("name") or "").strip()
        if not name:
            continue

        # word-boundary match for names; allow special tokens like C++ / C# via loose matching
        n = normalize_skill_text(name)
        if len(n) >= 2:
            if re.search(rf"(?<![A-Za-z0-9]){re.escape(n)}(?![A-Za-z0-9])", text):
                bump(sid, name, "name")

        for a in s.get("aliases", []) or []:
            a = (a or "").strip()
            if not a:
                continue
            al = normalize_skill_text(a)
            if re.search(rf"(?<![A-Za-z0-9]){re.escape(al)}(?![A-Za-z0-9])", text):
                bump(sid, name, "alias")

    # sort by count desc then name
    return sorted(matches.values(), key=lambda x: (-x.count, x.skill_name.lower()))

async def _load_user_items(db, user_id: str) -> list[dict]:
    user_filter = ref_query("user_id", user_id)
    # prefer unified portfolio_items
    items = await db["portfolio_items"].find(user_filter).to_list(length=2000)
    has_portfolio_items = bool(items)
    evidence_docs = await db["evidence"].find(user_filter).sort("updated_at", -1).to_list(length=1000)
    for evidence in evidence_docs:
        items.append(
            {
                "_id": evidence["_id"],
                "type": f"evidence:{evidence.get('type', 'other')}",
                "title": evidence.get("title", "") or "Evidence",
                "org": None,
                "summary": evidence.get("text_excerpt") or "",
                "bullets": [],
                "links": [evidence.get("source")] if evidence.get("source") else [],
                "skill_ids": evidence.get("skill_ids", []) or [],
                "priority": 1,
                "updated_at": evidence.get("updated_at"),
                "created_at": evidence.get("created_at"),
            }
        )
    # fallback: projects as items (if you haven't migrated yet)
    if not has_portfolio_items:
        projs = await db["projects"].find(user_filter).to_list(length=500)
        for p in projs:
            items.append({
                "_id": p["_id"],
                "type": "project",
                "title": p.get("title", ""),
                "org": None,
                "summary": p.get("description"),
                "bullets": [],
                "links": [],
                "skill_ids": [],
                "priority": 0,
                "updated_at": p.get("updated_at"),
                "created_at": p.get("created_at"),
            })
    return items

def _score_item(item: dict, job_skill_ids: set[str], keywords: set[str]) -> float:
    sids = {str(sid) for sid in (item.get("skill_ids", []) or [])}
    overlap = len(sids & job_skill_ids)
    pri = float(item.get("priority", 0) or 0)

    # keyword overlap from title + summary + bullets
    txt = normalize_skill_text(" ".join(
        [item.get("title",""), item.get("summary","")] + (item.get("bullets", []) or [])
    ))
    kw_hit = sum(1 for k in keywords if k in txt)

    return overlap * 5.0 + kw_hit * 1.0 + pri * 0.25

def _dedupe_preserve_order(values: Iterable[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = str(value or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out

def _normalize_text_blob(item: dict) -> str:
    parts = [item.get("title", ""), item.get("summary", ""), item.get("org", "")]
    parts.extend(item.get("bullets", []) or [])
    parts.extend(item.get("links", []) or [])
    return normalize_skill_text(" ".join(str(part or "") for part in parts))

async def _load_profile_confirmation(db, user_id: str) -> dict | None:
    confirmation = await db["resume_skill_confirmations"].find_one(
        {"user_id": {"$in": ref_values(user_id)}, "resume_snapshot_id": None},
        sort=[("created_at", -1)],
    )
    if confirmation:
        return confirmation
    return await db["resume_skill_confirmations"].find_one(
        {"user_id": {"$in": ref_values(user_id)}},
        sort=[("created_at", -1)],
    )

async def _load_skills_by_ids(db, skill_ids: Iterable[str]) -> dict[str, dict]:
    oids: list[ObjectId] = []
    raw_ids: list[str] = []
    for skill_id in skill_ids:
        text = str(skill_id or "").strip()
        if not text:
            continue
        raw_ids.append(text)
        oid = to_object_id(text) if ObjectId.is_valid(text) else None
        if oid is not None:
            oids.append(oid)
    if not raw_ids:
        return {}

    query_values: list[object] = list(oids)
    query_values.extend(text for text in raw_ids if text not in {str(oid) for oid in oids})
    docs = await db["skills"].find(
        {"_id": {"$in": query_values}},
        {"name": 1, "category": 1, "aliases": 1, "hidden": 1},
    ).to_list(length=max(len(query_values), 1))
    visible_docs = [doc for doc in docs if not _is_hidden_skill_doc(doc)]
    merged_docs = merge_skill_docs(visible_docs)
    out: dict[str, dict] = {}
    for doc in merged_docs:
        merged_ids = list(doc.get("merged_ids") or [])
        if not merged_ids and doc.get("_id") is not None:
            merged_ids = [oid_str(doc.get("_id"))]
        for merged_id in merged_ids:
            text = str(merged_id or "").strip()
            if text:
                out[text] = doc
    return out

def _skill_terms(doc: dict | None) -> set[str]:
    if not doc:
        return set()
    values = [(doc.get("name") or "").strip()]
    values.extend(str(alias or "").strip() for alias in (doc.get("aliases") or []))
    terms: set[str] = set()
    for value in values:
        if not value:
            continue
        normalized = normalize_skill_text(value)
        if normalized:
            terms.add(normalized)
    return terms

def _score_percent(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100.0, 2)

def _clamp_score(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 2)

def _skill_match_pattern(value: str) -> str:
    return rf"(?<![A-Za-z0-9]){re.escape(normalize_skill_text(value))}(?![A-Za-z0-9])"

def _classify_job_skill_priority(job_text: str, extracted: list[dict], skill_docs: dict[str, dict]) -> tuple[set[str], set[str]]:
    required_markers = (
        "required", "requirements", "must have", "must-have", "minimum qualifications",
        "basic qualifications", "you will need", "need to have"
    )
    preferred_markers = (
        "preferred", "nice to have", "nice-to-have", "bonus", "preferred qualifications",
        "ideal", "plus", "would be a plus"
    )

    current_section: str | None = None
    required_ids: set[str] = set()
    preferred_ids: set[str] = set()
    section_reset_markers = (
        "responsibilities", "what you'll do", "what you will do", "about the role",
        "benefits", "compensation", "about us", "why join", "who we are",
    )
    section_blocks: dict[str, list[str]] = {"required": [], "preferred": []}
    extracted_terms_by_id: dict[str, set[str]] = {}

    for entry in extracted:
        skill_id = str(entry.get("skill_id") or "")
        if not skill_id:
            continue
        terms = _skill_terms(skill_docs.get(skill_id))
        if terms:
            extracted_terms_by_id[skill_id] = terms

    for raw_line in (job_text or "").splitlines():
        line = raw_line.strip()
        if not line:
            current_section = None
            continue
        lower = normalize_skill_text(line)
        if any(marker in lower for marker in required_markers):
            current_section = "required"
        elif any(marker in lower for marker in preferred_markers):
            current_section = "preferred"
        elif any(marker in lower for marker in section_reset_markers):
            current_section = None
        elif len(lower) < 60 and lower.endswith(":"):
            current_section = None

        if current_section in {"required", "preferred"}:
            section_blocks[current_section].append(lower)

        for skill_id, terms in extracted_terms_by_id.items():
            if not any(term and re.search(_skill_match_pattern(term), lower) for term in terms):
                continue
            if current_section == "required":
                required_ids.add(skill_id)
            elif current_section == "preferred":
                preferred_ids.add(skill_id)

    for section_name, target_ids in (("required", required_ids), ("preferred", preferred_ids)):
        block_text = "\n".join(section_blocks.get(section_name) or [])
        if not block_text:
            continue
        for skill_id, terms in extracted_terms_by_id.items():
            if any(term and re.search(_skill_match_pattern(term), block_text) for term in terms):
                target_ids.add(skill_id)

    if not required_ids:
        strong_required_blob = "\n".join(
            normalize_skill_text(raw_line.strip())
            for raw_line in (job_text or "").splitlines()
            if raw_line.strip()
            and (
                any(marker in normalize_skill_text(raw_line) for marker in required_markers)
                or re.search(r"\b(must|required|minimum)\b", normalize_skill_text(raw_line))
            )
        )
        if strong_required_blob:
            for skill_id, terms in extracted_terms_by_id.items():
                if any(term and re.search(_skill_match_pattern(term), strong_required_blob) for term in terms):
                    required_ids.add(skill_id)

    preferred_ids -= required_ids
    return required_ids, preferred_ids

def _match_confidence_label(score: float) -> str:
    if score >= 85:
        return "Strong"
    if score >= 70:
        return "Promising"
    if score >= 50:
        return "Moderate"
    return "Early"

def _build_strength_areas(matched_skill_docs: list[dict], evidence_backed_ids: set[str], item_hits: list[dict]) -> list[str]:
    category_counts: dict[str, int] = {}
    evidence_category_counts: dict[str, int] = {}
    for doc in matched_skill_docs:
        category = (doc.get("category") or "General").strip() or "General"
        category_counts[category] = category_counts.get(category, 0) + 1
        if oid_str(doc.get("_id")) in evidence_backed_ids:
            evidence_category_counts[category] = evidence_category_counts.get(category, 0) + 1

    ordered_categories = sorted(category_counts.items(), key=lambda item: (-item[1], item[0].lower()))
    strengths: list[str] = []
    for category, count in ordered_categories[:3]:
        evidence_count = evidence_category_counts.get(category, 0)
        if evidence_count > 0:
            strengths.append(f"{category} ({count} matched, {evidence_count} evidence-backed)")
        else:
            strengths.append(f"{category} ({count} matched skills)")

    if item_hits:
        top_item = item_hits[0]
        title = (top_item.get("title") or "").strip()
        item_type = str(top_item.get("type") or "work").replace("evidence:", "").replace("_", " ")
        if title:
            strengths.append(f"{item_type.title()} evidence from {title}")

    return strengths[:4]

def _display_skill_name(doc: dict | None, fallback: str = "") -> str:
    if not doc:
        return fallback
    return str(doc.get("name") or fallback or "").strip()

def _dedupe_skill_ids_by_name(skill_ids: Iterable[str], skill_docs: dict[str, dict]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for skill_id in skill_ids:
        name = normalize_skill_text(_display_skill_name(skill_docs.get(skill_id), skill_id))
        if not name or name in seen:
            continue
        seen.add(name)
        ordered.append(skill_id)
    return ordered

def _serialize_history(doc: dict) -> JobMatchHistoryEntryOut:
    analysis = doc.get("analysis") or {}
    return JobMatchHistoryEntryOut(
        id=oid_str(doc.get("_id")),
        job_id=oid_str(doc.get("job_id")),
        title=doc.get("title"),
        company=doc.get("company"),
        location=doc.get("location"),
        match_score=float(analysis.get("match_score") or 0),
        semantic_alignment_score=float(analysis.get("semantic_alignment_score") or 0),
        matched_skills=[str(value) for value in analysis.get("matched_skills", []) or []],
        missing_skills=[str(value) for value in analysis.get("missing_skills", []) or []],
        strength_areas=[str(value) for value in analysis.get("strength_areas", []) or []],
        related_skills=[str(value) for value in analysis.get("related_skills", []) or []],
        tailored_resume_id=oid_str(doc.get("tailored_resume_id")) if doc.get("tailored_resume_id") else None,
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )

def _serialize_tailored_resume(doc: dict) -> TailoredResumeOut:
    return TailoredResumeOut(
        id=oid_str(doc.get("_id")),
        user_id=oid_str(doc.get("user_id")),
        job_id=str(doc.get("job_id")) if doc.get("job_id") is not None else None,
        template=str(doc.get("template") or "ats_v1"),
        selected_skill_ids=[oid_str(value) for value in (doc.get("selected_skill_ids") or [])],
        selected_item_ids=[oid_str(value) for value in (doc.get("selected_item_ids") or [])],
        sections=[ResumeSection(**section) for section in (doc.get("sections") or [])],
        plain_text=str(doc.get("plain_text") or ""),
        created_at=doc.get("created_at"),
    )


def _serialize_tailored_resume_list_entry(doc: dict, job_doc: dict | None = None) -> TailoredResumeListEntryOut:
    job_doc = job_doc or {}
    raw_job_id = doc.get("job_id")
    return TailoredResumeListEntryOut(
        id=oid_str(doc.get("_id")),
        user_id=oid_str(doc.get("user_id")),
        job_id=oid_str(raw_job_id) if raw_job_id is not None else None,
        job_title=str(job_doc.get("title") or "").strip() or None,
        company=str(job_doc.get("company") or "").strip() or None,
        location=str(job_doc.get("location") or "").strip() or None,
        template=str(doc.get("template") or "ats_v1"),
        selected_skill_count=len(doc.get("selected_skill_ids") or []),
        selected_item_count=len(doc.get("selected_item_ids") or []),
        created_at=doc.get("created_at"),
    )


def _serialize_tailored_resume_detail(doc: dict, job_doc: dict | None = None) -> TailoredResumeDetailOut:
    base = _serialize_tailored_resume(doc)
    job_doc = job_doc or {}
    return TailoredResumeDetailOut(
        **base.model_dump(),
        job_title=str(job_doc.get("title") or "").strip() or None,
        company=str(job_doc.get("company") or "").strip() or None,
        location=str(job_doc.get("location") or "").strip() or None,
        selected_skill_count=len(doc.get("selected_skill_ids") or []),
        selected_item_count=len(doc.get("selected_item_ids") or []),
    )

def _render_plain_text(sections: list[ResumeSection]) -> str:
    lines: list[str] = []
    for sec in sections:
        lines.append(sec.title.upper())
        for ln in sec.lines:
            lines.append(ln)
        lines.append("")
    return "\n".join(lines).strip() + "\n"

@router.post("/job/ingest", response_model=JobIngestOut)
async def ingest_job(payload: JobIngestIn):
    db = get_db()
    skills = await _load_skill_catalog(db)
    extracted = _match_skills(payload.text, skills)
    keywords = _tokenize_keywords(payload.text, extracted)

    now = now_utc()
    doc = payload.model_dump()
    doc["user_id"] = to_object_id(payload.user_id)
    doc["extracted_skills"] = [e.model_dump() for e in extracted[:200]]
    doc["keywords"] = keywords
    doc["created_at"] = now
    # store full text; keep preview for response
    res = await db["job_ingests"].insert_one(doc)

    preview = payload.text.strip().replace("\n", " ")
    if len(preview) > 220:
        preview = preview[:220] + "..."

    return JobIngestOut(
        id=oid_str(res.inserted_id),
        user_id=payload.user_id,
        title=payload.title,
        company=payload.company,
        location=payload.location,
        text_preview=preview,
        extracted_skills=extracted[:75],
        keywords=keywords,
        created_at=now,
    )

@router.post("/match", response_model=JobMatchOut)
async def match_job(payload: dict):
    """
    Expects:
    {
        "user_id": "...",
        "job_id": "..."   # this is the JobIngestOut.id from /tailor/job/ingest
    }
    """
    db = get_db()

    try:
        job_oid = ObjectId(payload["job_id"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job_id")

    job_doc = await db["job_ingests"].find_one({"_id": job_oid, **ref_query("user_id", payload["user_id"])})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job ingest not found for user_id")

    extracted = job_doc.get("extracted_skills") or []
    raw_extracted_skill_ids = _dedupe_preserve_order(str(e.get("skill_id")) for e in extracted if e.get("skill_id"))

    conf = await _load_profile_confirmation(db, payload["user_id"])
    user_skill_ids = {
        str(entry.get("skill_id"))
        for entry in (conf or {}).get("confirmed", [])
        if entry.get("skill_id") is not None
    }
    items = await _load_user_items(db, payload["user_id"])
    item_skill_ids = {
        str(skill_id)
        for item in items
        for skill_id in (item.get("skill_ids") or [])
        if skill_id is not None
    }
    all_skill_docs = await _load_skills_by_ids(db, set(raw_extracted_skill_ids) | user_skill_ids | item_skill_ids)
    extracted_skill_ids = [skill_id for skill_id in raw_extracted_skill_ids if skill_id in all_skill_docs]
    extracted_skill_ids = _dedupe_skill_ids_by_name(extracted_skill_ids, all_skill_docs)
    priority_extracted = [entry for entry in extracted if str(entry.get("skill_id") or "") in all_skill_docs]
    required_ids, preferred_ids = _classify_job_skill_priority(job_doc.get("text", ""), priority_extracted, all_skill_docs)
    required_ids = set(_dedupe_skill_ids_by_name(required_ids, all_skill_docs))
    preferred_ids = set(_dedupe_skill_ids_by_name(preferred_ids, all_skill_docs)) - required_ids
    confirmed_term_lookup = {
        term
        for skill_id in user_skill_ids
        for term in _skill_terms(all_skill_docs.get(skill_id))
    }
    matched_ids = []
    for skill_id in extracted_skill_ids:
        if skill_id in user_skill_ids:
            matched_ids.append(skill_id)
            continue
        if _skill_terms(all_skill_docs.get(skill_id)) & confirmed_term_lookup:
            matched_ids.append(skill_id)
    matched_ids = _dedupe_skill_ids_by_name(matched_ids, all_skill_docs)
    matched_skill_id_set = set(matched_ids)
    missing_ids = [skill_id for skill_id in extracted_skill_ids if skill_id not in matched_skill_id_set]
    matched_required_ids = [skill_id for skill_id in matched_ids if skill_id in required_ids]
    matched_preferred_ids = [skill_id for skill_id in matched_ids if skill_id in preferred_ids]
    matched_term_lookup = {
        term
        for skill_id in matched_ids
        for term in _skill_terms(all_skill_docs.get(skill_id))
    }
    item_text = " ".join(_normalize_text_blob(item) for item in items)
    matched_item_hits: list[dict] = []
    evidence_backed_ids: set[str] = set()
    for item in items:
        item_terms = {
            term
            for sid in (item.get("skill_ids") or [])
            for term in _skill_terms(all_skill_docs.get(str(sid)))
        }
        if item_terms & matched_term_lookup:
            matched_item_hits.append(item)
            for skill_id in matched_ids:
                if _skill_terms(all_skill_docs.get(skill_id)) & item_terms:
                    evidence_backed_ids.add(skill_id)
    keywords = [str(keyword or "").strip().lower() for keyword in (job_doc.get("keywords") or []) if str(keyword or "").strip()]
    keyword_overlap_terms = [keyword for keyword in keywords if keyword in item_text]
    keyword_overlap_count = len(keyword_overlap_terms)

    matched_docs = [all_skill_docs[skill_id] for skill_id in matched_ids if skill_id in all_skill_docs]

    semantic_alignment_score = 0.0
    related_skill_ids: list[str] = []
    if job_doc.get("text"):
        ordered_user_skill_ids = [skill_id for skill_id in user_skill_ids if skill_id in all_skill_docs]
        skill_texts = [
            " ".join(
                [
                    all_skill_docs[skill_id].get("name", ""),
                    all_skill_docs[skill_id].get("category", ""),
                    " ".join(all_skill_docs[skill_id].get("aliases", []) or []),
                ]
            ).strip()
            for skill_id in ordered_user_skill_ids
        ]
        item_texts = [_normalize_text_blob(item) for item in items]
        vectors, _provider = await embed_texts([job_doc.get("text", "")] + skill_texts + item_texts)
        if vectors:
            job_vec = vectors[0]
            skill_vectors = vectors[1 : 1 + len(skill_texts)]
            item_vectors = vectors[1 + len(skill_texts) :]
            ranked_related: list[tuple[float, str]] = []
            skill_similarity_by_id: dict[str, float] = {}
            for skill_id, skill_vec in zip(ordered_user_skill_ids, skill_vectors):
                sim = cosine_similarity(job_vec, skill_vec)
                skill_similarity_by_id[skill_id] = sim
                if skill_id in matched_skill_id_set:
                    continue
                if sim >= 0.18:
                    ranked_related.append((sim, skill_id))
            ranked_related.sort(key=lambda item: item[0], reverse=True)
            related_skill_ids = [skill_id for _score, skill_id in ranked_related[:5]]

            semantic_examples: list[tuple[float, str]] = []
            if item_vectors:
                extracted_skill_id_set = set(extracted_skill_ids)
                weighted_item_scores: list[float] = []
                for item, item_vec in zip(items, item_vectors):
                    sim = cosine_similarity(job_vec, item_vec)
                    item_skill_id_set = {str(sid) for sid in (item.get("skill_ids") or []) if sid is not None}
                    overlap_ratio = len(item_skill_id_set & extracted_skill_id_set) / max(1, len(item_skill_id_set | extracted_skill_id_set))
                    bonus = overlap_ratio * 0.18
                    item_terms = {
                        term
                        for sid in item_skill_id_set
                        for term in _skill_terms(all_skill_docs.get(sid))
                    }
                    if item_terms & matched_term_lookup:
                        bonus += 0.08
                    combined_score = sim + bonus
                    weighted_item_scores.append(combined_score)
                    title = str(item.get("title") or item.get("summary") or "Saved evidence").strip()
                    if combined_score >= 0.22 and title:
                        semantic_examples.append((combined_score, f"{title} aligns with the posting language and matched skills"))
                top_item_alignment = _top_average(weighted_item_scores, 5)
            else:
                top_item_alignment = 0.0

            matched_skill_alignment = _top_average(
                (skill_similarity_by_id.get(skill_id, 0.0) for skill_id in ordered_user_skill_ids if _skill_terms(all_skill_docs.get(skill_id)) & matched_term_lookup),
                5,
            )
            overall_skill_alignment = _top_average(skill_similarity_by_id.values(), 6)
            for skill_id in related_skill_ids[:3]:
                name = _display_skill_name(all_skill_docs.get(skill_id), skill_id)
                if name:
                    semantic_examples.append((skill_similarity_by_id.get(skill_id, 0.0), f"Related confirmed skill: {name}"))
            semantic_alignment_score = _clamp_score(
                (
                    (top_item_alignment * 0.50)
                    + (matched_skill_alignment * 0.35)
                    + (overall_skill_alignment * 0.15)
                ) * 100.0
            )
        else:
            semantic_examples = []
    else:
        semantic_examples = []

    required_coverage_score = _score_percent(len(matched_required_ids), len(required_ids)) if required_ids else 100.0
    preferred_coverage_score = _score_percent(len(matched_preferred_ids), len(preferred_ids)) if preferred_ids else 100.0
    overall_coverage_score = _score_percent(len(matched_ids), len(extracted_skill_ids))
    weighted_skill_score = _clamp_score(
        (required_coverage_score * 0.55)
        + (preferred_coverage_score * 0.20)
        + (overall_coverage_score * 0.25)
    )
    evidence_score = _score_percent(len(evidence_backed_ids), len(matched_ids) or len(extracted_skill_ids))
    evidence_gap_count = max(0, len(matched_ids) - len(evidence_backed_ids))
    keyword_score = _score_percent(keyword_overlap_count, len(keywords))
    overall_score = _clamp_score(
        (weighted_skill_score * 0.50)
        + (evidence_score * 0.22)
        + (keyword_score * 0.10)
        + (semantic_alignment_score * 0.18)
    )

    breakdown = [
        MatchScoreBreakdown(
            label="Required skill coverage",
            score=required_coverage_score,
            detail=(
                f"{len(matched_required_ids)} of {len(required_ids)} likely required skills are already confirmed"
                if required_ids
                else "No clearly required skill section was detected, so this score starts at full credit"
            ),
        ),
        MatchScoreBreakdown(
            label="Preferred and secondary coverage",
            score=_clamp_score((preferred_coverage_score * 0.6) + (overall_coverage_score * 0.4)),
            detail=(
                f"{len(matched_preferred_ids)} of {len(preferred_ids)} preferred skills are covered, with {len(matched_ids)} total matched job skills"
                if preferred_ids
                else f"{len(matched_ids)} of {len(extracted_skill_ids)} total extracted job skills are covered"
            ),
        ),
        MatchScoreBreakdown(
            label="Evidence support",
            score=evidence_score,
            detail=f"{len(evidence_backed_ids)} matched skills are backed by evidence, leaving {evidence_gap_count} matched skills without proof",
        ),
        MatchScoreBreakdown(
            label="Keyword overlap",
            score=keyword_score,
            detail=f"{keyword_overlap_count} of {len(keywords)} job keywords appear in your saved work history",
        ),
        MatchScoreBreakdown(
            label="Semantic alignment",
            score=semantic_alignment_score,
            detail="Concept-level similarity between the job description and your saved work, even when the exact words do not match",
        ),
    ]

    missing_names = [_display_skill_name(all_skill_docs.get(skill_id), skill_id) for skill_id in missing_ids if skill_id in all_skill_docs]
    matched_names = [_display_skill_name(all_skill_docs.get(skill_id), skill_id) for skill_id in matched_ids if skill_id in all_skill_docs]
    related_skill_names = [all_skill_docs[skill_id].get("name", skill_id) for skill_id in related_skill_ids if skill_id in all_skill_docs]
    semantic_alignment_examples = [text for _score, text in sorted(semantic_examples, key=lambda item: item[0], reverse=True)[:4]]
    strength_areas = _build_strength_areas(matched_docs, evidence_backed_ids, matched_item_hits)
    confidence_label = _match_confidence_label(overall_score)
    semantic_alignment_explanation = (
        "Semantic alignment estimates how closely your saved evidence, projects, and confirmed skills resemble the responsibilities and tools in the job posting, even when the wording is different."
    )
    analysis_summary_parts = [
        f"{confidence_label} fit based on {len(matched_ids)} matched skills out of {len(extracted_skill_ids)} extracted job skills."
    ]
    if required_ids:
        analysis_summary_parts.append(f"You currently cover {len(matched_required_ids)} of {len(required_ids)} likely required skills.")
    if evidence_backed_ids:
        analysis_summary_parts.append(f"{len(evidence_backed_ids)} matched skills are already supported by evidence.")
    elif matched_ids:
        analysis_summary_parts.append("Your confirmed skills are not yet strongly supported by evidence.")
    analysis_summary = " ".join(analysis_summary_parts)

    next_steps: list[str] = []
    if missing_names:
        prefix = "Prioritize" if required_ids and any(skill_id in required_ids for skill_id in missing_ids) else "Add evidence or learning proof for"
        next_steps.append(f"{prefix} {', '.join(missing_names[:3])}")
    if evidence_gap_count > 0:
        next_steps.append("Attach evidence to more matched skills so the tailored resume can prove capability instead of only claiming it")
    if not matched_item_hits:
        next_steps.append("Add projects or evidence with measurable outcomes to improve resume tailoring")
    if related_skill_names:
        next_steps.append(f"Consider positioning related experience like {', '.join(related_skill_names[:2])} when exact matches are limited")

    result = JobMatchOut(
        job_id=oid_str(job_doc["_id"]),
        match_score=overall_score,
        match_confidence_label=confidence_label,
        analysis_summary=analysis_summary,
        matched_skill_ids=matched_ids,
        matched_skills=matched_names,
        missing_skill_ids=missing_ids,
        missing_skills=missing_names,
        matched_skill_count=len(matched_names),
        missing_skill_count=len(missing_names),
        strength_areas=strength_areas,
        related_skills=related_skill_names,
        semantic_alignment_examples=semantic_alignment_examples,
        score_breakdown=breakdown,
        recommended_next_steps=next_steps[:3],
        extracted_skill_count=len(extracted_skill_ids),
        confirmed_skill_count=len(user_skill_ids),
        required_skill_count=len(required_ids),
        required_matched_count=len(matched_required_ids),
        preferred_skill_count=len(preferred_ids),
        preferred_matched_count=len(matched_preferred_ids),
        evidence_aligned_count=len(evidence_backed_ids),
        evidence_gap_count=evidence_gap_count,
        keyword_overlap_count=keyword_overlap_count,
        keyword_overlap_terms=keyword_overlap_terms,
        semantic_alignment_score=semantic_alignment_score,
        semantic_alignment_explanation=semantic_alignment_explanation,
    )

    now = now_utc()
    history_doc = {
        "user_id": to_object_id(payload["user_id"]),
        "job_id": job_oid,
        "title": job_doc.get("title"),
        "company": job_doc.get("company"),
        "location": job_doc.get("location"),
        "text_preview": job_doc.get("text", "")[:220],
        "analysis": result.model_dump(),
        "created_at": now,
        "updated_at": now,
    }
    history_res = await db["job_match_runs"].insert_one(history_doc)
    result.history_id = oid_str(history_res.inserted_id)
    await db["job_match_runs"].update_one({"_id": history_res.inserted_id}, {"$set": {"analysis.history_id": result.history_id}})
    return result

@router.post("/preview", response_model=TailoredResumeOut)
async def preview_tailored_resume(payload: TailorPreviewIn):
    db = get_db()

    job_text = payload.job_text
    job_id = payload.job_id

    extracted: list[ExtractedSkill] = []
    keywords: list[str] = []

    if job_id:
        try:
            job_oid = ObjectId(job_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid job_id")

        job_doc = await db["job_ingests"].find_one({"_id": job_oid, **ref_query("user_id", payload.user_id)})
        if not job_doc:
            raise HTTPException(status_code=404, detail="Job ingest not found for user_id")
        job_text = job_doc.get("text", "")
        extracted = [ExtractedSkill(**e) for e in (job_doc.get("extracted_skills") or [])]
        keywords = job_doc.get("keywords") or []
    else:
        if not job_text or len(job_text) < 50:
            raise HTTPException(status_code=400, detail="Provide job_id or job_text (>=50 chars)")
        skills = await _load_skill_catalog(db)
        extracted = _match_skills(job_text, skills)
        keywords = _tokenize_keywords(job_text, extracted)

    ordered_job_skill_ids = _dedupe_preserve_order(e.skill_id for e in extracted[:50])
    job_skill_ids = set(ordered_job_skill_ids)
    keyword_set = set(keywords)

    # load user portfolio items and user evidence-backed items
    items = await _load_user_items(db, payload.user_id)

    scored = []
    for it in items:
        scored.append(( _score_item(it, job_skill_ids, keyword_set), it))
    scored.sort(key=lambda x: x[0], reverse=True)

    selected_items = [it for score, it in scored[: payload.max_items] if score > 0] or [it for score, it in scored[: payload.max_items]]
    selected_item_ids = [oid_str(it["_id"]) for it in selected_items if "_id" in it]

    # Select skills: prioritize skills that appear in both job and user's confirmed skills if available
    confirmed_skill_ids: set[str] = set()
    conf = await db["resume_skill_confirmations"].find_one({"user_id": {"$in": ref_values(payload.user_id)}}, sort=[("created_at", -1)])
    if conf:
        for c in conf.get("confirmed", []) or []:
            sid = c.get("skill_id")
            if sid is None:
                continue
            confirmed_skill_ids.add(str(sid))

    selected_skill_ids = [sid for sid in ordered_job_skill_ids if sid in confirmed_skill_ids]
    if len(selected_skill_ids) < 10:
        # backfill by job skills
        for e in extracted:
            if e.skill_id not in selected_skill_ids:
                selected_skill_ids.append(e.skill_id)
            if len(selected_skill_ids) >= 15:
                break

    # Resolve skill names for display
    skill_name_by_id: dict[str, str] = {}
    if selected_skill_ids:
        oids = []
        for sid in selected_skill_ids:
            try:
                oids.append(ObjectId(sid))
            except Exception:
                continue
        if oids:
            docs = await db["skills"].find({"_id": {"$in": oids}}, {"name": 1}).to_list(length=200)
            for d in docs:
                skill_name_by_id[oid_str(d["_id"])] = d.get("name", "")

    skill_names = [skill_name_by_id.get(s, s) for s in selected_skill_ids if skill_name_by_id.get(s, s)]
    skill_line = ", ".join(skill_names)[:250]
    job_title = (job_doc.get("title") or "").strip() if job_id else ""
    company = (job_doc.get("company") or "").strip() if job_id else ""
    target_label = " ".join(part for part in [job_title, f"at {company}" if company else ""] if part).strip() or "this role"

    # Compose sections
    sections: list[ResumeSection] = []

    # Summary
    sections.append(
        ResumeSection(
            title="Summary",
            lines=[
                "Software / ML-focused builder with hands-on experience delivering projects end-to-end (API, data, and deployment).",
                f"Tailored for {target_label} with emphasis on {skill_line}." if skill_line else f"Tailored for {target_label} with emphasis on the role requirements and deliverables described in the posting.",
            ],
        )
    )

    # Skills
    if selected_skill_ids:
        sections.append(
            ResumeSection(
                title="Skills",
                lines=[
                    ", ".join([skill_name_by_id.get(s, s) for s in selected_skill_ids if skill_name_by_id.get(s, s)]) or skill_line
                ],
            )
        )

    # Portfolio
    proj_lines: list[str] = []
    for it in selected_items:
        title = it.get("title", "Untitled")
        org = it.get("org")
        dates = ""
        if it.get("date_start") or it.get("date_end"):
            dates = f" ({it.get('date_start','')}-{it.get('date_end','')})".replace(" -", "-").replace("-)", ")")
        kind = str(it.get("type") or "work").replace("evidence:", "").replace("_", " ")
        header = f"{title}{' — ' + org if org else ''}{dates}".strip()
        if kind:
            header = f"{header} [{kind.title()}]"
        proj_lines.append(header)

        bullets = (it.get("bullets") or [])[: payload.max_bullets_per_item]
        if bullets:
            for b in bullets:
                proj_lines.append(f"- {b}")
        else:
            summ = it.get("summary") or ""
            if summ:
                proj_lines.append(f"- {summ}")
            else:
                proj_lines.append("- Relevant portfolio item selected based on skills/keywords overlap with the job posting.")
        links = it.get("links") or []
        if links:
            proj_lines.append(f"- Links: {', '.join(links[:3])}")

        proj_lines.append("")  # spacing

    if proj_lines:
        sections.append(ResumeSection(title="Relevant Work", lines=[ln for ln in proj_lines if ln != "" ]))

    if skill_names:
        sections.append(
            ResumeSection(
                title="Targeted Alignment",
                lines=[
                    f"Role focus: {target_label}",
                    f"Prioritized skills: {', '.join(skill_names[:10])}",
                    f"Selected evidence items: {len(selected_items)}",
                ],
            )
        )

    # Store tailored resume record
    now = now_utc()
    record = {
        "user_id": to_object_id(payload.user_id),
        "job_id": job_id,
        "job_text": job_text,
        "template": payload.template,
        "selected_skill_ids": selected_skill_ids,
        "selected_item_ids": selected_item_ids,
        "sections": [s.model_dump() for s in sections],
        "plain_text": _render_plain_text(sections),
        "created_at": now,
        "updated_at": now,
    }
    res = await db["tailored_resumes"].insert_one(record)

    if job_id and ObjectId.is_valid(job_id):
        latest_history = await db["job_match_runs"].find_one(
            {"user_id": {"$in": ref_values(payload.user_id)}, "job_id": ObjectId(job_id)},
            sort=[("created_at", -1)],
        )
        if latest_history:
            await db["job_match_runs"].update_one(
                {"_id": latest_history["_id"]},
                {"$set": {"tailored_resume_id": res.inserted_id, "updated_at": now}},
            )

    return _serialize_tailored_resume({"_id": res.inserted_id, **record})


@router.get("/resumes", response_model=list[TailoredResumeListEntryOut])
async def list_tailored_resumes(user_id: str, limit: int = 100):
    db = get_db()
    capped_limit = max(1, min(limit, 200))
    docs = await (
        db["tailored_resumes"]
        .find(ref_query("user_id", user_id))
        .sort("created_at", -1)
        .limit(capped_limit)
        .to_list(length=capped_limit)
    )

    job_ids: list[ObjectId] = []
    for doc in docs:
        raw_job_id = doc.get("job_id")
        if isinstance(raw_job_id, ObjectId):
            job_ids.append(raw_job_id)
        elif isinstance(raw_job_id, str) and ObjectId.is_valid(raw_job_id):
            job_ids.append(ObjectId(raw_job_id))

    job_docs = await db["job_ingests"].find(
        {"_id": {"$in": job_ids}},
        {"title": 1, "company": 1, "location": 1},
    ).to_list(length=len(job_ids) or 1)
    jobs_by_id = {oid_str(job.get("_id")): job for job in job_docs}

    return [
        _serialize_tailored_resume_list_entry(doc, jobs_by_id.get(oid_str(doc.get("job_id"))))
        for doc in docs
    ]


@router.delete("/resumes/{tailored_id}")
async def delete_tailored_resume(tailored_id: str, user_id: str):
    db = get_db()
    try:
        oid = ObjectId(tailored_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tailored_id")

    doc = await db["tailored_resumes"].find_one({"_id": oid, **ref_query("user_id", user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Tailored resume not found")

    await db["tailored_resumes"].delete_one({"_id": oid})
    await db["job_match_runs"].update_many(
        {"user_id": {"$in": ref_values(user_id)}, "tailored_resume_id": oid},
        {"$unset": {"tailored_resume_id": ""}, "$set": {"updated_at": now_utc()}},
    )
    return {"ok": True, "id": tailored_id}


@router.get("/resumes/{tailored_id}", response_model=TailoredResumeDetailOut)
async def get_tailored_resume_detail(tailored_id: str, user_id: str):
    db = get_db()
    try:
        oid = ObjectId(tailored_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tailored_id")

    doc = await db["tailored_resumes"].find_one({"_id": oid, **ref_query("user_id", user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Tailored resume not found")

    raw_job_id = doc.get("job_id")
    job_doc = None
    if isinstance(raw_job_id, ObjectId):
        job_doc = await db["job_ingests"].find_one({"_id": raw_job_id}, {"title": 1, "company": 1, "location": 1})
    elif isinstance(raw_job_id, str) and ObjectId.is_valid(raw_job_id):
        job_doc = await db["job_ingests"].find_one({"_id": ObjectId(raw_job_id)}, {"title": 1, "company": 1, "location": 1})

    return _serialize_tailored_resume_detail(doc, job_doc)

@router.get("/history", response_model=list[JobMatchHistoryEntryOut])
async def list_job_match_history(user_id: str, limit: int = 12):
    db = get_db()
    cursor = db["job_match_runs"].find(ref_query("user_id", user_id)).sort("created_at", -1).limit(max(1, min(limit, 30)))
    docs = await cursor.to_list(length=max(1, min(limit, 30)))
    return [_serialize_history(doc) for doc in docs]

@router.get("/history/{history_id}", response_model=JobMatchHistoryDetailOut)
async def get_job_match_history_detail(history_id: str, user_id: str):
    db = get_db()
    try:
        oid = ObjectId(history_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid history id")

    doc = await db["job_match_runs"].find_one({"_id": oid, **ref_query("user_id", user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="History entry not found")

    base = _serialize_history(doc)
    job_text = None
    job_id = doc.get("job_id")
    if job_id is not None and ObjectId.is_valid(str(job_id)):
        job_doc = await db["job_ingests"].find_one({"_id": ObjectId(str(job_id)), **ref_query("user_id", user_id)})
        if job_doc:
            job_text = job_doc.get("text")

    analysis = JobMatchOut(**(doc.get("analysis") or {}))
    return JobMatchHistoryDetailOut(
        **base.model_dump(),
        text_preview=doc.get("text_preview"),
        job_text=job_text,
        analysis=analysis,
    )

@router.delete("/history/{history_id}")
async def delete_job_match_history(history_id: str, user_id: str):
    db = get_db()
    try:
        oid = ObjectId(history_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid history id")

    doc = await db["job_match_runs"].find_one({"_id": oid, **ref_query("user_id", user_id)}, {"title": 1, "company": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="History entry not found")

    await db["job_match_runs"].delete_one({"_id": oid})
    return {
        "ok": True,
        "id": history_id,
        "title": doc.get("title") or doc.get("company") or "Saved job match",
    }

@router.get("/history/compare", response_model=JobMatchCompareOut)
async def compare_job_match_history(user_id: str, left_id: str, right_id: str):
    db = get_db()
    try:
        left_oid = ObjectId(left_id)
        right_oid = ObjectId(right_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid history id")

    docs = await db["job_match_runs"].find(
        {"_id": {"$in": [left_oid, right_oid]}, **ref_query("user_id", user_id)}
    ).to_list(length=2)
    by_id = {oid_str(doc["_id"]): doc for doc in docs}
    if left_id not in by_id or right_id not in by_id:
        raise HTTPException(status_code=404, detail="History entry not found")

    left = _serialize_history(by_id[left_id])
    right = _serialize_history(by_id[right_id])
    left_matched = set(left.matched_skills)
    right_matched = set(right.matched_skills)
    left_missing = set(left.missing_skills)
    right_missing = set(right.missing_skills)

    return JobMatchCompareOut(
        left=left,
        right=right,
        match_score_delta=round(right.match_score - left.match_score, 2),
        semantic_alignment_delta=round(right.semantic_alignment_score - left.semantic_alignment_score, 2),
        newly_matched_skills=sorted(right_matched - left_matched),
        newly_missing_skills=sorted(right_missing - left_missing),
        shared_strength_areas=sorted(set(left.strength_areas) & set(right.strength_areas)),
    )

@router.get("/settings/status", response_model=AISettingsStatusOut)
async def get_ai_settings_status():
    return AISettingsStatusOut(**get_inference_status())

@router.post("/{tailored_id}/rewrite", response_model=RewriteBulletsOut)
async def rewrite_tailored_resume_bullets(tailored_id: str, payload: RewriteBulletsIn):
    db = get_db()
    try:
        oid = ObjectId(tailored_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tailored_id")

    doc = await db["tailored_resumes"].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Tailored resume not found")

    sections = [ResumeSection(**section) for section in doc.get("sections", [])]
    relevant_index = next((index for index, section in enumerate(sections) if section.title.lower() == "relevant work"), None)
    if relevant_index is None:
        raise HTTPException(status_code=400, detail="Tailored resume has no relevant work section to rewrite")

    work_lines = sections[relevant_index].lines
    bullet_indices = [index for index, line in enumerate(work_lines) if str(line).startswith("- ")]
    bullets = [work_lines[index] for index in bullet_indices]
    if not bullets:
        raise HTTPException(status_code=400, detail="Tailored resume has no bullets to rewrite")

    job_text = str(doc.get("job_text") or "")
    if not job_text and doc.get("job_id") and ObjectId.is_valid(str(doc.get("job_id"))):
        job_doc = await db["job_ingests"].find_one({"_id": ObjectId(str(doc.get("job_id")))})
        job_text = str((job_doc or {}).get("text") or "")

    rewritten_bullets, provider = await rewrite_resume_bullets(job_text, bullets, payload.focus)
    rewritten_count = 0
    for line_index, bullet in zip(bullet_indices, rewritten_bullets):
        work_lines[line_index] = bullet
        rewritten_count += 1

    updated_sections = [section.model_dump() for section in sections]
    updated_at = now_utc()
    plain_text = _render_plain_text(sections)
    await db["tailored_resumes"].update_one(
        {"_id": oid},
        {
            "$set": {
                "sections": updated_sections,
                "plain_text": plain_text,
                "updated_at": updated_at,
                "rewrite_focus": payload.focus,
                "rewrite_provider": provider,
            }
        },
    )

    return RewriteBulletsOut(
        tailored_id=tailored_id,
        provider=provider,
        focus=payload.focus,
        rewritten_count=rewritten_count,
        sections=sections,
        plain_text=plain_text,
        updated_at=updated_at,
    )

def _docx_from_sections(sections: list[ResumeSection], out_path: str):
    from docx import Document
    doc = Document()
    for sec in sections:
        doc.add_heading(sec.title, level=2)
        for ln in sec.lines:
            if ln.startswith("- "):
                doc.add_paragraph(ln[2:], style="List Bullet")
            else:
                doc.add_paragraph(ln)
    doc.save(out_path)

def _pdf_from_sections(sections: list[ResumeSection], out_path: str):
    from reportlab.lib.pagesizes import LETTER
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from reportlab.lib.utils import simpleSplit

    c = canvas.Canvas(out_path, pagesize=LETTER)
    width, height = LETTER
    x = 54
    y = height - 54
    max_width = width - (x * 2)
    line_h = 14

    def draw_wrapped(text: str, bold: bool = False, indent: int = 0):
        nonlocal y
        font_name = "Helvetica-Bold" if bold else "Helvetica"
        font_size = 12 if bold else 11
        wrapped = simpleSplit(text, font_name, font_size, max_width - indent)
        for line in wrapped or [""]:
            if y < 54:
                c.showPage()
                y = height - 54
            c.setFont(font_name, font_size)
            c.drawString(x + indent, y, line)
            y -= line_h

    for sec in sections:
        draw_wrapped(sec.title.upper(), bold=True)
        for ln in sec.lines:
            if ln.startswith("- "):
                bullet = u"\u2022"
                bullet_width = stringWidth(bullet, "Helvetica", 11)
                if y < 54:
                    c.showPage()
                    y = height - 54
                c.setFont("Helvetica", 11)
                c.drawString(x, y, bullet)
                draw_wrapped(ln[2:], indent=int(bullet_width + 10))
            else:
                draw_wrapped(ln)
        draw_wrapped("")

    c.save()

@router.get("/{tailored_id}/export/docx")
async def export_docx(tailored_id: str):
    db = get_db()
    try:
        oid = ObjectId(tailored_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tailored_id")

    d = await db["tailored_resumes"].find_one({"_id": oid})
    if not d:
        raise HTTPException(status_code=404, detail="Tailored resume not found")

    sections = [ResumeSection(**s) for s in d.get("sections", [])]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
    tmp.close()
    _docx_from_sections(sections, tmp.name)

    filename = f"tailored_resume_{tailored_id}.docx"
    return FileResponse(tmp.name, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename=filename)

@router.get("/{tailored_id}/export/pdf")
async def export_pdf(tailored_id: str):
    db = get_db()
    try:
        oid = ObjectId(tailored_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tailored_id")

    d = await db["tailored_resumes"].find_one({"_id": oid})
    if not d:
        raise HTTPException(status_code=404, detail="Tailored resume not found")

    sections = [ResumeSection(**s) for s in d.get("sections", [])]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.close()
    _pdf_from_sections(sections, tmp.name)

    filename = f"tailored_resume_{tailored_id}.pdf"
    return FileResponse(tmp.name, media_type="application/pdf", filename=filename)
