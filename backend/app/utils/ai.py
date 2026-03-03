from __future__ import annotations

import hashlib
import math
import re
from typing import Iterable


STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "your", "will", "have", "has", "into",
    "using", "used", "their", "they", "them", "must", "plus", "able", "work", "team", "role",
    "more", "less", "some", "many", "each", "make", "made", "over", "under", "than", "then",
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


async def embed_texts(texts: Iterable[str]) -> tuple[list[list[float]], str]:
    cleaned = [str(text or "").strip() for text in texts]
    if not cleaned:
        return [], "local-hash"
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
    for idx, bullet in enumerate(bullets):
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


def _extract_candidates_locally(text: str, max_candidates: int = 25) -> list[dict]:
    lowered = str(text or "")
    patterns = [
        r"(?:experience with|experienced in|proficient in|knowledge of|using|built with|worked with|familiar with)\s+([A-Za-z0-9+.#/\- ]{2,60})",
        r"(?:skills|technologies|tools|frameworks)\s*:\s*([A-Za-z0-9+.#/\-, ]{2,120})",
    ]

    phrases: list[str] = []
    for pattern in patterns:
        for match in re.finditer(pattern, lowered, re.IGNORECASE):
            block = match.group(1)
            for part in re.split(r",|/| and ", block):
                phrase = part.strip(" .;:()[]{}")
                if 2 <= len(phrase) <= 40:
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
        seen.add(key)
        out.append({"name": normalized, "category": ""})
        if len(out) >= max_candidates:
            break
    return out


async def extract_skill_candidates(text: str, max_candidates: int = 25) -> tuple[list[dict], str]:
    cleaned = str(text or "").strip()
    if not cleaned:
        return [], "local-rule"
    return _extract_candidates_locally(cleaned, max_candidates=max_candidates), "local-rule"
