from __future__ import annotations

import hashlib
import math
import os
import re
from functools import lru_cache
from typing import Iterable

from app.core.config import settings


# Avoid tokenizer/process helper fan-out on macOS/Python 3.12, which can
# leave semaphore warnings behind during interpreter shutdown.
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")


STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "your", "will", "have", "has", "into",
    "using", "used", "their", "they", "them", "must", "plus", "able", "work", "team", "role",
    "more", "less", "some", "many", "each", "make", "made", "over", "under", "than", "then",
}

SKILL_LABELS = [
    "technical skill",
    "software tool",
    "framework or library",
    "programming language",
    "cloud platform",
    "data skill",
    "soft skill",
    "not a skill",
]

SKILL_CATEGORY_BY_LABEL = {
    "technical skill": "Technical",
    "software tool": "Tooling",
    "framework or library": "Frameworks",
    "programming language": "Programming",
    "cloud platform": "Cloud",
    "data skill": "Data",
    "soft skill": "Professional",
    "not a skill": "",
}


def _tokenize(text: str) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{2,}", (text or "").lower())
    return [word for word in words if word not in STOPWORDS]


def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vec))
    if norm <= 0:
        return vec
    return [value / norm for value in vec]


def hashed_embedding(text: str, dims: int = 128) -> list[float]:
    vec = [0.0] * dims
    for token in _tokenize(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        slot = int.from_bytes(digest[:4], "big") % dims
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        weight = 1.0 + min(len(token), 12) / 12.0
        vec[slot] += sign * weight
    return _normalize(vec)


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    return round(sum(a * b for a, b in zip(left, right)), 4)


@lru_cache(maxsize=1)
def _load_sentence_transformer():
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(settings.local_embedding_model)
    except Exception:
        return None


@lru_cache(maxsize=1)
def _load_zero_shot_pipeline():
    try:
        from transformers import pipeline

        return pipeline(
            "zero-shot-classification",
            model=settings.local_zero_shot_model,
            device=settings.local_model_device,
        )
    except Exception:
        return None


def get_inference_status() -> dict[str, str]:
    embed_model = _load_sentence_transformer()
    zero_shot = _load_zero_shot_pipeline()
    embeddings_provider = "local-transformer" if embed_model is not None else "local-hash"
    rewrite_provider = "local-rule"
    return {
        "provider_mode": "Local Transformer" if embed_model is not None or zero_shot is not None else "Local Fallback",
        "embeddings_provider": embeddings_provider,
        "rewrite_provider": rewrite_provider,
        "embedding_model": settings.local_embedding_model if embed_model is not None else "hashed-embedding-v1",
        "rewrite_model": "resume-rule-rewriter-v1",
    }


async def warm_local_models() -> dict[str, str]:
    status = get_inference_status()
    # Touch both paths so the first real request does not pay model init cost.
    await embed_texts(["python fastapi mongodb", "machine learning project experience"])
    await extract_skill_candidates("Python, FastAPI, MongoDB, machine learning, leadership", max_candidates=5)
    return get_inference_status() if status else status


async def embed_texts(texts: Iterable[str]) -> tuple[list[list[float]], str]:
    cleaned = [str(text or "").strip() for text in texts]
    if not cleaned:
        return [], "local-hash"

    model = _load_sentence_transformer()
    if model is not None:
        try:
            vectors = model.encode(cleaned, normalize_embeddings=True)
            return [list(map(float, row)) for row in vectors], "local-transformer"
        except Exception:
            pass

    return [hashed_embedding(text) for text in cleaned], "local-hash"


def _rewrite_locally(job_text: str, bullets: list[str], focus: str) -> list[str]:
    keywords = []
    seen = set()
    for token in _tokenize(job_text):
        if token in seen:
            continue
        seen.add(token)
        keywords.append(token)
        if len(keywords) >= 6:
            break

    rewritten: list[str] = []
    for bullet in bullets:
        base = re.sub(r"^\s*[-*]\s*", "", str(bullet or "").strip())
        if not base:
            continue
        sentence = base[0].upper() + base[1:] if len(base) > 1 else base.upper()
        if not re.search(r"\b(led|built|designed|implemented|delivered|improved|developed|launched|automated|optimized)\b", sentence, re.IGNORECASE):
            sentence = f"Delivered {sentence[0].lower() + sentence[1:]}" if len(sentence) > 1 else f"Delivered {sentence.lower()}"
        if focus == "ats" and keywords:
            sentence = f"{sentence} Relevant keywords: {', '.join(keywords[:2])}."
        elif focus == "impact":
            sentence = f"{sentence} Highlighted measurable impact and ownership."
        else:
            if keywords:
                sentence = f"{sentence} Aligned with {keywords[0]} requirements."
        rewritten.append(f"- {sentence}")
    return rewritten


async def rewrite_resume_bullets(job_text: str, bullets: list[str], focus: str = "balanced") -> tuple[list[str], str]:
    cleaned = [re.sub(r"^\s*[-*]\s*", "", str(bullet or "").strip()) for bullet in bullets if str(bullet or "").strip()]
    if not cleaned:
        return [], "local-rule"
    return _rewrite_locally(job_text, cleaned, focus), "local-rule"


def _extract_candidates_locally(text: str, max_candidates: int = 40) -> list[dict]:
    lowered = str(text or "")
    patterns = [
        r"(?:experience with|experienced in|proficient in|knowledge of|using|built with|worked with|familiar with|expertise in)\s+([A-Za-z0-9+.#/\- ]{2,80})",
        r"(?:skills|technologies|tools|frameworks|platforms)\s*:\s*([A-Za-z0-9+.#/\-, ]{2,160})",
    ]

    phrases: list[str] = []
    for pattern in patterns:
        for match in re.finditer(pattern, lowered, re.IGNORECASE):
            block = match.group(1)
            for part in re.split(r",|/| and |\bor\b", block):
                phrase = part.strip(" .;:()[]{}")
                if 2 <= len(phrase) <= 50:
                    phrases.append(phrase)

    lines = [line.strip(" -*•\t") for line in lowered.splitlines() if line.strip()]
    for line in lines:
        if len(line) < 8:
            continue
        for part in re.split(r",|;|/|\band\b", line):
            phrase = part.strip(" .;:()[]{}")
            if 2 <= len(phrase) <= 50:
                phrases.append(phrase)

    tech_tokens = re.findall(r"\b[A-Za-z][A-Za-z0-9+.#-]{1,24}\b", lowered)
    for token in tech_tokens:
        if any(ch.isupper() for ch in token) or any(ch in token for ch in "+#."):
            phrases.append(token)

    out: list[dict] = []
    seen: set[str] = set()
    for phrase in phrases:
        normalized = re.sub(r"\s+", " ", phrase).strip()
        key = normalized.lower()
        if key in seen or key in STOPWORDS or len(key) < 2:
            continue
        if re.fullmatch(r"\d+(\.\d+)?", key):
            continue
        if len(key.split()) > 5:
            continue
        seen.add(key)
        out.append({"name": normalized, "category": ""})
        if len(out) >= max_candidates:
            break
    return out


def _classify_candidate_locally(name: str) -> tuple[bool, str]:
    low = str(name or "").strip().lower()
    if not low:
        return False, ""
    bad_prefixes = ("responsible for", "ability to", "ability in", "candidate should", "must be able")
    if any(low.startswith(prefix) for prefix in bad_prefixes):
        return False, ""
    if len(low.split()) == 1 and len(low) < 2:
        return False, ""
    if re.search(r"\b(salary|benefits|equal opportunity|applicants|company)\b", low):
        return False, ""
    return True, "General"


async def extract_skill_candidates(text: str, max_candidates: int = 25) -> tuple[list[dict], str]:
    cleaned = str(text or "").strip()
    if not cleaned:
        return [], "local-rule"

    local_candidates = _extract_candidates_locally(cleaned, max_candidates=max_candidates * 3)
    classifier = _load_zero_shot_pipeline()
    if classifier is None:
        filtered: list[dict] = []
        for candidate in local_candidates:
            ok, category = _classify_candidate_locally(candidate.get("name", ""))
            if not ok:
                continue
            filtered.append({"name": candidate["name"], "category": category})
            if len(filtered) >= max_candidates:
                break
        return filtered, "local-rule"

    filtered: list[dict] = []
    for candidate in local_candidates:
        name = str(candidate.get("name") or "").strip()
        if not name:
            continue
        try:
            result = classifier(name, SKILL_LABELS, multi_label=False)
        except Exception:
            ok, category = _classify_candidate_locally(name)
            if ok:
                filtered.append({"name": name, "category": category})
            if len(filtered) >= max_candidates:
                break
            continue

        labels = result.get("labels") or []
        scores = result.get("scores") or []
        if not labels or not scores:
            continue
        top_label = str(labels[0])
        top_score = float(scores[0])
        if top_label == "not a skill" and top_score >= 0.45:
            continue
        if top_label != "not a skill" and top_score >= 0.25:
            filtered.append(
                {
                    "name": name,
                    "category": SKILL_CATEGORY_BY_LABEL.get(top_label, "General"),
                }
            )
        if len(filtered) >= max_candidates:
            break

    deduped: list[dict] = []
    seen: set[str] = set()
    for candidate in filtered:
        key = str(candidate.get("name") or "").strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(candidate)
    return deduped[:max_candidates], "local-transformer" if deduped else "local-rule"
