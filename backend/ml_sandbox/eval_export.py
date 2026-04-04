"""Safe export helpers that derive anonymized evaluation sets from live SkillBridge data."""

from __future__ import annotations

import hmac
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any, Iterable, Sequence


EMAIL_RE = re.compile(r"\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})")
URL_RE = re.compile(r"(?:https?://|www\.)\S+", re.IGNORECASE)
IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
LOCATION_RE = re.compile(
    r"\b[A-Z][a-z]+(?:[\s,]+[A-Z][a-z]+)*(?:,\s*[A-Z]{2}|\s+[A-Z]{2})\b"
)
WHITESPACE_RE = re.compile(r"\s+")


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _stable_token(prefix: str, value: str, salt: str) -> str:
    digest = hmac.new(salt.encode("utf-8"), value.encode("utf-8"), sha256).hexdigest()[:12]
    return f"{prefix}_{digest}"


def _clean_text(value: str) -> str:
    return WHITESPACE_RE.sub(" ", str(value or "").strip())


def _looks_like_name_line(value: str) -> bool:
    text = _clean_text(value)
    if not text or len(text) > 60:
        return False
    if "@" in text or URL_RE.search(text) or PHONE_RE.search(text):
        return False
    tokens = [token for token in re.split(r"\s+", text) if token]
    if not 2 <= len(tokens) <= 4:
        return False
    return all(token[:1].isupper() and re.search(r"[A-Za-z]", token) for token in tokens)


def _secret_terms(user_doc: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for key in ("email", "username", "name", "full_name"):
        raw = str(user_doc.get(key) or "").strip()
        if not raw:
            continue
        values.append(raw)
        if key == "email" and "@" in raw:
            values.append(raw.split("@", 1)[0])
    return sorted({value for value in values if len(value) >= 3}, key=len, reverse=True)


def redact_text(value: str, user_doc: dict[str, Any] | None = None, max_chars: int = 1600) -> str:
    text = str(value or "")
    if not text.strip():
        return ""

    lines = [line.rstrip() for line in text.splitlines()]
    redacted_lines: list[str] = []
    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            if redacted_lines and redacted_lines[-1]:
                redacted_lines.append("")
            continue
        if index < 4 and (_looks_like_name_line(stripped) or PHONE_RE.search(stripped) or EMAIL_RE.search(stripped) or URL_RE.search(stripped)):
            redacted_lines.append("[HEADER]")
            continue
        if index < 4 and LOCATION_RE.search(stripped) and len(stripped) <= 48:
            redacted_lines.append("[LOCATION]")
            continue
        redacted_lines.append(stripped)

    text = "\n".join(redacted_lines)
    text = EMAIL_RE.sub("[EMAIL]", text)
    text = PHONE_RE.sub("[PHONE]", text)
    text = URL_RE.sub("[URL]", text)
    text = IP_RE.sub("[IP]", text)

    for secret in _secret_terms(user_doc or {}):
        text = re.sub(re.escape(secret), "[USER]", text, flags=re.IGNORECASE)

    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text).strip()
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip() + "..."


def skill_lookup(skills: Sequence[dict[str, Any]]) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for skill in skills:
        key = str(skill.get("_id") or "").strip()
        name = _clean_text(skill.get("name") or skill.get("skill_name") or "")
        if key and name:
            lookup[key] = name
    return lookup


def _canonical_user_id(value: Any) -> str:
    return str(value or "").strip()


def _timestamp_value(value: Any) -> float:
    if isinstance(value, datetime):
        return value.timestamp()
    if isinstance(value, (int, float)):
        return float(value)
    return 0.0


def _latest_confirmation_by_snapshot(confirmations: Sequence[dict[str, Any]]) -> dict[tuple[str, str], dict[str, Any]]:
    ordered = sorted(
        confirmations,
        key=lambda doc: _timestamp_value(doc.get("updated_at") or doc.get("created_at")),
        reverse=True,
    )
    out: dict[tuple[str, str], dict[str, Any]] = {}
    for doc in ordered:
        user_id = _canonical_user_id(doc.get("user_id"))
        snapshot_id = _canonical_user_id(doc.get("resume_snapshot_id"))
        if not user_id:
            continue
        out.setdefault((user_id, snapshot_id), doc)
    return out


def _skill_names(values: Iterable[Any], skills_by_id: dict[str, str], limit: int = 12) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for value in values:
        name = _clean_text(skills_by_id.get(str(value or "").strip(), ""))
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        names.append(name)
        if len(names) >= limit:
            break
    return names


def _sentence_snippets(text: str, limit: int = 2) -> list[str]:
    snippets: list[str] = []
    for chunk in re.split(r"(?<=[.!?])\s+|•|\n|;", str(text or "")):
        cleaned = _clean_text(chunk.strip(" -"))
        if len(cleaned) < 24:
            continue
        snippets.append(cleaned.rstrip(".") + ".")
        if len(snippets) >= limit:
            break
    return snippets


def _sort_recent(docs: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        docs,
        key=lambda doc: _timestamp_value(doc.get("updated_at") or doc.get("created_at")),
        reverse=True,
    )


def build_extraction_samples(
    *,
    users: Sequence[dict[str, Any]],
    skills: Sequence[dict[str, Any]],
    evidence_docs: Sequence[dict[str, Any]],
    resume_snapshots: Sequence[dict[str, Any]],
    confirmations: Sequence[dict[str, Any]],
    anon_salt: str,
    max_per_user: int = 8,
    min_text_chars: int = 40,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    skills_by_id = skill_lookup(skills)
    users_by_id = {_canonical_user_id(user.get("_id")): user for user in users}
    confirmation_by_snapshot = _latest_confirmation_by_snapshot(confirmations)
    samples: list[dict[str, Any]] = []
    per_user_counts: defaultdict[str, int] = defaultdict(int)
    stats = {"evidence_candidates": 0, "resume_candidates": 0, "skipped_short_text": 0, "skipped_missing_labels": 0}

    for evidence in _sort_recent(evidence_docs):
        if str(evidence.get("origin") or "user").strip().lower() == "system":
            continue
        user_id = _canonical_user_id(evidence.get("user_id"))
        if user_id not in users_by_id or per_user_counts[user_id] >= max_per_user:
            continue
        text = redact_text(
            evidence.get("summary") or evidence.get("text_excerpt") or " ".join(evidence.get("bullets") or []),
            user_doc=users_by_id[user_id],
            max_chars=900,
        )
        expected_skills = _skill_names(evidence.get("skill_ids") or [], skills_by_id)
        if len(text) < min_text_chars:
            stats["skipped_short_text"] += 1
            continue
        if not expected_skills:
            stats["skipped_missing_labels"] += 1
            continue
        per_user_counts[user_id] += 1
        stats["evidence_candidates"] += 1
        samples.append(
            {
                "id": _stable_token("extract", f"evidence:{evidence.get('_id')}", anon_salt),
                "text": text,
                "expected_skills": expected_skills,
                "metadata": {
                    "source": "evidence",
                    "type": str(evidence.get("type") or "unknown"),
                },
            }
        )

    for snapshot in _sort_recent(resume_snapshots):
        user_id = _canonical_user_id(snapshot.get("user_id"))
        if user_id not in users_by_id or per_user_counts[user_id] >= max_per_user:
            continue
        confirmation = confirmation_by_snapshot.get((user_id, _canonical_user_id(snapshot.get("_id"))))
        confirmed_entries = (confirmation or {}).get("confirmed") or []
        expected_skills = _skill_names((entry.get("skill_id") for entry in confirmed_entries), skills_by_id)
        text = redact_text(snapshot.get("raw_text") or "", user_doc=users_by_id[user_id], max_chars=2400)
        if len(text) < max(120, min_text_chars):
            stats["skipped_short_text"] += 1
            continue
        if not expected_skills:
            stats["skipped_missing_labels"] += 1
            continue
        per_user_counts[user_id] += 1
        stats["resume_candidates"] += 1
        samples.append(
            {
                "id": _stable_token("extract", f"resume:{snapshot.get('_id')}", anon_salt),
                "text": text,
                "expected_skills": expected_skills,
                "metadata": {
                    "source": "resume_snapshot",
                    "source_type": str(snapshot.get("source_type") or "unknown"),
                },
            }
        )

    return samples, stats


def _candidate_pool_by_user(
    users: Sequence[dict[str, Any]],
    evidence_docs: Sequence[dict[str, Any]],
    resume_snapshots: Sequence[dict[str, Any]],
    anon_salt: str,
) -> dict[str, list[dict[str, Any]]]:
    users_by_id = {_canonical_user_id(user.get("_id")): user for user in users}
    pools: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for evidence in _sort_recent(evidence_docs):
        if str(evidence.get("origin") or "user").strip().lower() == "system":
            continue
        user_id = _canonical_user_id(evidence.get("user_id"))
        user_doc = users_by_id.get(user_id)
        if not user_doc:
            continue
        text = redact_text(
            evidence.get("summary") or evidence.get("text_excerpt") or " ".join(evidence.get("bullets") or []),
            user_doc=user_doc,
            max_chars=500,
        )
        for index, snippet in enumerate(_sentence_snippets(text, limit=2), start=1):
            pools[user_id].append(
                {
                    "candidate_id": _stable_token("cand", f"evidence:{evidence.get('_id')}:{index}", anon_salt),
                    "source_key": f"evidence:{evidence.get('_id')}",
                    "source_type": "evidence",
                    "text": snippet,
                }
            )

    for snapshot in _sort_recent(resume_snapshots):
        user_id = _canonical_user_id(snapshot.get("user_id"))
        user_doc = users_by_id.get(user_id)
        if not user_doc:
            continue
        text = redact_text(snapshot.get("raw_text") or "", user_doc=user_doc, max_chars=900)
        for index, snippet in enumerate(_sentence_snippets(text, limit=3), start=1):
            pools[user_id].append(
                {
                    "candidate_id": _stable_token("cand", f"resume:{snapshot.get('_id')}:{index}", anon_salt),
                    "source_key": f"resume_snapshot:{snapshot.get('_id')}",
                    "source_type": "resume_snapshot",
                    "text": snippet,
                }
            )
    return pools


def _positive_candidates(
    retrieved_context: Sequence[dict[str, Any]],
    user_doc: dict[str, Any],
    anon_salt: str,
) -> list[dict[str, Any]]:
    positives: list[dict[str, Any]] = []
    seen: set[str] = set()
    for context in retrieved_context:
        source_type = str(context.get("source_type") or "").strip() or "unknown"
        source_id = str(context.get("source_id") or "").strip()
        snippet = redact_text(context.get("snippet") or "", user_doc=user_doc, max_chars=320)
        key = f"{source_type}:{source_id}:{snippet.lower()}"
        if len(snippet) < 24 or key in seen:
            continue
        seen.add(key)
        positives.append(
            {
                "id": _stable_token("cand", key, anon_salt),
                "text": snippet,
                "label": 1,
                "metadata": {
                    "source_type": source_type,
                    "score_bucket": round(float(context.get("score") or 0.0), 2),
                },
                "_source_key": f"{source_type}:{source_id}" if source_id else "",
            }
        )
    return positives


def build_ranking_samples(
    *,
    users: Sequence[dict[str, Any]],
    evidence_docs: Sequence[dict[str, Any]],
    resume_snapshots: Sequence[dict[str, Any]],
    job_match_runs: Sequence[dict[str, Any]],
    tailored_resumes: Sequence[dict[str, Any]],
    anon_salt: str,
    max_per_user: int = 8,
    negative_count: int = 3,
    min_query_chars: int = 80,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    users_by_id = {_canonical_user_id(user.get("_id")): user for user in users}
    pools = _candidate_pool_by_user(users, evidence_docs, resume_snapshots, anon_salt)
    samples: list[dict[str, Any]] = []
    per_user_counts: defaultdict[str, int] = defaultdict(int)
    stats = {"job_match_candidates": 0, "tailored_candidates": 0, "skipped_no_positive": 0, "skipped_no_negative": 0, "skipped_short_query": 0}

    def append_sample(*, user_id: str, raw_id: str, query_text: str, positives: list[dict[str, Any]], source: str) -> None:
        if per_user_counts[user_id] >= max_per_user:
            return
        query = redact_text(query_text, user_doc=users_by_id[user_id], max_chars=700)
        if len(query) < min_query_chars:
            stats["skipped_short_query"] += 1
            return
        if not positives:
            stats["skipped_no_positive"] += 1
            return
        blocked_keys = {candidate.get("_source_key") for candidate in positives if candidate.get("_source_key")}
        negatives: list[dict[str, Any]] = []
        seen_negative_text: set[str] = set()
        for candidate in pools.get(user_id, []):
            if candidate.get("source_key") in blocked_keys:
                continue
            text = candidate.get("text") or ""
            if text.lower() in seen_negative_text:
                continue
            seen_negative_text.add(text.lower())
            negatives.append(
                {
                    "id": candidate["candidate_id"],
                    "text": text,
                    "label": 0,
                    "metadata": {"source_type": candidate["source_type"]},
                }
            )
            if len(negatives) >= negative_count:
                break
        if not negatives:
            stats["skipped_no_negative"] += 1
            return

        per_user_counts[user_id] += 1
        samples.append(
            {
                "id": _stable_token("rank", raw_id, anon_salt),
                "query": query,
                "candidates": [{k: v for k, v in candidate.items() if not k.startswith("_")} for candidate in [*positives, *negatives]],
                "metadata": {"task": source},
            }
        )
        if source == "job-match-retrieval":
            stats["job_match_candidates"] += 1
        else:
            stats["tailored_candidates"] += 1

    for doc in _sort_recent(job_match_runs):
        user_id = _canonical_user_id(doc.get("user_id"))
        user_doc = users_by_id.get(user_id)
        if not user_doc:
            continue
        analysis = dict(doc.get("analysis") or {})
        positives = _positive_candidates(analysis.get("retrieved_context") or [], user_doc, anon_salt)
        append_sample(
            user_id=user_id,
            raw_id=f"job_match:{doc.get('_id')}",
            query_text=str(doc.get("job_text_snapshot") or doc.get("text_preview") or ""),
            positives=positives,
            source="job-match-retrieval",
        )

    evidence_by_id = {str(doc.get("_id")): doc for doc in evidence_docs}
    for doc in _sort_recent(tailored_resumes):
        user_id = _canonical_user_id(doc.get("user_id"))
        user_doc = users_by_id.get(user_id)
        if not user_doc:
            continue
        positives = _positive_candidates(doc.get("retrieved_context") or [], user_doc, anon_salt)
        if not positives:
            for item_id in doc.get("selected_item_ids") or []:
                evidence = evidence_by_id.get(str(item_id))
                if not evidence:
                    continue
                snippet = redact_text(
                    evidence.get("summary") or evidence.get("text_excerpt") or " ".join(evidence.get("bullets") or []),
                    user_doc=user_doc,
                    max_chars=320,
                )
                for sentence in _sentence_snippets(snippet, limit=1):
                    positives.append(
                        {
                            "id": _stable_token("cand", f"selected-item:{item_id}:{sentence}", anon_salt),
                            "text": sentence,
                            "label": 1,
                            "metadata": {"source_type": "evidence"},
                            "_source_key": f"evidence:{item_id}",
                        }
                    )
        append_sample(
            user_id=user_id,
            raw_id=f"tailored:{doc.get('_id')}",
            query_text=str(doc.get("job_text") or ""),
            positives=positives,
            source="tailored-retrieval",
        )

    return samples, stats


def _rewrite_bullets_from_sections(sections: Sequence[dict[str, Any]]) -> list[str]:
    for title_group in ({"relevant work", "targeted highlights"}, {"experience", "projects"}):
        for section in sections:
            title = _clean_text(section.get("title") or "").lower()
            if title not in title_group:
                continue
            bullets = [
                _clean_text(line)
                for line in (section.get("lines") or [])
                if _clean_text(line).startswith("- ")
            ]
            if bullets:
                return bullets[:6]
    return []


def build_rewrite_samples(
    *,
    users: Sequence[dict[str, Any]],
    skills: Sequence[dict[str, Any]],
    tailored_resumes: Sequence[dict[str, Any]],
    job_ingests: Sequence[dict[str, Any]],
    anon_salt: str,
    max_per_user: int = 6,
    min_job_text_chars: int = 80,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    users_by_id = {_canonical_user_id(user.get("_id")): user for user in users}
    skills_by_id = skill_lookup(skills)
    jobs_by_id = {str(job.get("_id")): job for job in job_ingests}
    samples: list[dict[str, Any]] = []
    per_user_counts: defaultdict[str, int] = defaultdict(int)
    stats = {"tailored_candidates": 0, "skipped_no_bullets": 0, "skipped_short_job_text": 0, "skipped_no_keywords": 0}

    for doc in _sort_recent(tailored_resumes):
        user_id = _canonical_user_id(doc.get("user_id"))
        user_doc = users_by_id.get(user_id)
        if not user_doc or per_user_counts[user_id] >= max_per_user:
            continue
        bullets = [redact_text(bullet, user_doc=user_doc, max_chars=240) for bullet in _rewrite_bullets_from_sections(doc.get("sections") or [])]
        bullets = [bullet for bullet in bullets if bullet]
        if not bullets:
            stats["skipped_no_bullets"] += 1
            continue
        job_doc = jobs_by_id.get(str(doc.get("job_id") or ""))
        job_text = redact_text(doc.get("job_text") or (job_doc or {}).get("text") or "", user_doc=user_doc, max_chars=1200)
        if len(job_text) < min_job_text_chars:
            stats["skipped_short_job_text"] += 1
            continue
        required_keywords = _skill_names(doc.get("selected_skill_ids") or [], skills_by_id, limit=10)
        if not required_keywords and job_doc:
            required_keywords = [
                _clean_text(keyword)
                for keyword in (job_doc.get("keywords") or [])
                if _clean_text(keyword)
            ][:10]
        if not required_keywords:
            stats["skipped_no_keywords"] += 1
            continue
        per_user_counts[user_id] += 1
        stats["tailored_candidates"] += 1
        samples.append(
            {
                "id": _stable_token("rewrite", f"tailored:{doc.get('_id')}", anon_salt),
                "job_text": job_text,
                "bullets": bullets,
                "focus": str(doc.get("rewrite_focus") or "balanced"),
                "required_keywords": required_keywords,
                "metadata": {
                    "task": "tailored-resume-rewrite",
                    "bullet_count": len(bullets),
                    "template_source": str(doc.get("template_source") or ""),
                },
            }
        )
    return samples, stats


@dataclass(frozen=True)
class ExportBundle:
    extraction_samples: list[dict[str, Any]]
    ranking_samples: list[dict[str, Any]]
    rewrite_samples: list[dict[str, Any]]
    manifest: dict[str, Any]


def build_export_bundle(
    *,
    users: Sequence[dict[str, Any]],
    skills: Sequence[dict[str, Any]],
    evidence_docs: Sequence[dict[str, Any]],
    resume_snapshots: Sequence[dict[str, Any]],
    confirmations: Sequence[dict[str, Any]],
    job_match_runs: Sequence[dict[str, Any]],
    tailored_resumes: Sequence[dict[str, Any]],
    job_ingests: Sequence[dict[str, Any]],
    anon_salt: str,
    max_per_user: int = 8,
    negative_count: int = 3,
) -> ExportBundle:
    extraction_samples, extraction_stats = build_extraction_samples(
        users=users,
        skills=skills,
        evidence_docs=evidence_docs,
        resume_snapshots=resume_snapshots,
        confirmations=confirmations,
        anon_salt=anon_salt,
        max_per_user=max_per_user,
    )
    ranking_samples, ranking_stats = build_ranking_samples(
        users=users,
        evidence_docs=evidence_docs,
        resume_snapshots=resume_snapshots,
        job_match_runs=job_match_runs,
        tailored_resumes=tailored_resumes,
        anon_salt=anon_salt,
        max_per_user=max_per_user,
        negative_count=negative_count,
    )
    rewrite_samples, rewrite_stats = build_rewrite_samples(
        users=users,
        skills=skills,
        tailored_resumes=tailored_resumes,
        job_ingests=job_ingests,
        anon_salt=anon_salt,
        max_per_user=max_per_user,
    )
    manifest = {
        "generated_at": _now_iso(),
        "safety": {
            "anon_scheme": "hmac-sha256",
            "text_redaction": ["email", "phone", "url", "ip", "header-name", "username"],
            "raw_ids_exported": False,
        },
        "counts": {
            "users": len(users),
            "skills": len(skills),
            "extraction_samples": len(extraction_samples),
            "ranking_samples": len(ranking_samples),
            "rewrite_samples": len(rewrite_samples),
        },
        "selection": {
            "max_per_user": max_per_user,
            "negative_count": negative_count,
        },
        "stats": {
            "extraction": extraction_stats,
            "ranking": ranking_stats,
            "rewrite": rewrite_stats,
        },
    }
    return ExportBundle(
        extraction_samples=extraction_samples,
        ranking_samples=ranking_samples,
        rewrite_samples=rewrite_samples,
        manifest=manifest,
    )


def write_jsonl(path: str | Path, rows: Sequence[dict[str, Any]]) -> Path:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with output_path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=True) + "\n")
    return output_path


def write_export_bundle(bundle: ExportBundle, output_dir: str | Path) -> dict[str, Path]:
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True, mode=0o700)
    paths = {
        "extraction": write_jsonl(target / "extraction_eval.jsonl", bundle.extraction_samples),
        "ranking": write_jsonl(target / "ranking_eval.jsonl", bundle.ranking_samples),
        "rewrite": write_jsonl(target / "rewrite_eval.jsonl", bundle.rewrite_samples),
    }
    manifest_path = target / "manifest.json"
    manifest_path.write_text(json.dumps(bundle.manifest, indent=2, sort_keys=True), encoding="utf-8")
    paths["manifest"] = manifest_path
    return paths
