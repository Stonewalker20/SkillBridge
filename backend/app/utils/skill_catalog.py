"""Skill catalog normalization and merge utilities that reconcile aliases, categories, and canonical skill documents."""

from __future__ import annotations

import re
from typing import Iterable

from bson import ObjectId

from app.utils.mongo import oid_str


STRICT_SHORT_SKILL_KEYS = {
    "ai",
    "bi",
    "c",
    "c#",
    "c++",
    "go",
    "ml",
    "qa",
    "r",
    "ui",
    "ux",
}


def normalize_skill_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()


def _pluralize_token(token: str) -> str | None:
    text = str(token or "").strip()
    if not text or len(text) <= 2:
        return None
    low = text.casefold()
    if low.endswith(("ss", "us")):
        return None
    if low.endswith("y") and len(low) > 2 and low[-2] not in "aeiou":
        return text[:-1] + "ies"
    if low.endswith(("s", "x", "z", "ch", "sh")):
        return text + "es"
    return text + "s"


def _singularize_token(token: str) -> str | None:
    text = str(token or "").strip()
    if not text or len(text) <= 3:
        return None
    low = text.casefold()
    if low.endswith("ies") and len(text) > 3:
        return text[:-3] + "y"
    if low.endswith("es") and low[:-2].endswith(("s", "x", "z", "ch", "sh")):
        return text[:-2]
    if low.endswith("s") and not low.endswith("ss"):
        return text[:-1]
    return None


def _inflected_variants(value: str) -> list[str]:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    if not text:
        return []

    variants = [text]
    tokens = text.split(" ")
    last = tokens[-1]
    plural = _pluralize_token(last)
    singular = _singularize_token(last)
    if plural:
        variants.append(" ".join(tokens[:-1] + [plural]))
    if singular:
        variants.append(" ".join(tokens[:-1] + [singular]))
    return unique_casefolded(variants)


def _initialism_variant(value: str) -> str | None:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    if not text or " " not in text:
        return None
    parts = [part for part in re.split(r"[\s/&+-]+", text) if part]
    letters = []
    for part in parts:
        alnum = re.sub(r"[^A-Za-z0-9]", "", part)
        if not alnum:
            continue
        letters.append(alnum[0].upper())
    if len(letters) < 2:
        return None
    return "".join(letters)


def unique_casefolded(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        text = re.sub(r"\s+", " ", str(value or "").strip())
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def expand_alias_variants(values: Iterable[str], base_name: str | None = None) -> list[str]:
    expanded: list[str] = []
    for value in values:
        expanded.extend(_inflected_variants(str(value or "")))
    if base_name:
        initialism = _initialism_variant(base_name)
        if initialism and not should_use_strict_exact_match(initialism):
            expanded.extend(_inflected_variants(initialism))
    deduped = unique_casefolded(expanded)
    if base_name:
        name_key = normalize_skill_text(base_name)
        deduped = [value for value in deduped if normalize_skill_text(value) != name_key]
    return deduped


def should_use_strict_exact_match(value: str | None) -> bool:
    normalized = normalize_skill_text(value)
    if not normalized:
        return True
    return normalized in STRICT_SHORT_SKILL_KEYS or len(normalized) <= 2


def canonical_skill_terms(doc: dict) -> list[str]:
    name = str(doc.get("name") or "").strip()
    aliases = [str(alias or "").strip() for alias in (doc.get("aliases") or [])]
    return unique_casefolded([name, *aliases])


def build_canonical_skill_index(docs: Iterable[dict]) -> tuple[dict[str, dict], dict[str, set[str]]]:
    exact_index: dict[str, dict] = {}
    term_index: dict[str, set[str]] = {}
    for doc in docs:
        skill_id = oid_str(doc.get("_id"))
        if not skill_id:
            continue
        for term in canonical_skill_terms(doc):
            normalized = normalize_skill_text(term)
            if not normalized:
                continue
            exact_index.setdefault(normalized, doc)
            term_index.setdefault(skill_id, set()).add(normalized)
    return exact_index, term_index


def lexical_skill_similarity(left: str | None, right: str | None) -> float:
    left_key = normalize_skill_text(left)
    right_key = normalize_skill_text(right)
    if not left_key or not right_key:
        return 0.0
    if left_key == right_key:
        return 1.0
    if should_use_strict_exact_match(left_key) or should_use_strict_exact_match(right_key):
        return 0.0
    left_tokens = {token for token in re.split(r"[\s/&+.#-]+", left_key) if token}
    right_tokens = {token for token in re.split(r"[\s/&+.#-]+", right_key) if token}
    if not left_tokens or not right_tokens:
        return 0.0
    overlap = len(left_tokens & right_tokens)
    union = len(left_tokens | right_tokens)
    if overlap == 0 or union == 0:
        return 0.0
    if (left_key in right_key or right_key in left_key) and len(left_tokens) >= 2 and len(right_tokens) >= 2:
        return max(overlap / union, 0.72)
    return overlap / union


def merge_skill_docs(docs: Iterable[dict], current_user_oid: ObjectId | None = None) -> list[dict]:
    grouped: dict[str, dict] = {}

    for raw_doc in docs:
        name = re.sub(r"\s+", " ", str(raw_doc.get("name") or "").strip())
        if not name:
            continue
        key = normalize_skill_text(name)
        if not key:
            continue

        doc_id = oid_str(raw_doc.get("_id"))
        if not doc_id:
            continue

        created_by = raw_doc.get("created_by_user_id")
        group = grouped.get(key)
        if group is None:
            group = {
                "_id": raw_doc.get("_id"),
                "name": name,
                "category": re.sub(r"\s+", " ", str(raw_doc.get("category") or "").strip()),
                "categories": [],
                "aliases": [],
                "tags": [],
                "proficiency": raw_doc.get("proficiency"),
                "last_used_at": raw_doc.get("last_used_at"),
                "origin": raw_doc.get("origin"),
                "hidden": raw_doc.get("hidden", False),
                "merged_ids": [],
                "_creator_ids": set(),
                "_has_default": False,
            }
            grouped[key] = group

        if group.get("_has_default") is False and created_by is None:
            group["_id"] = raw_doc.get("_id")
            group["name"] = name
            group["category"] = re.sub(r"\s+", " ", str(raw_doc.get("category") or "").strip())
            group["origin"] = raw_doc.get("origin") or "default"
            group["_has_default"] = True

        if created_by is not None:
            group["_creator_ids"].add(oid_str(created_by))
        elif created_by is None:
            group["_has_default"] = True

        group["merged_ids"].append(doc_id)
        category = re.sub(r"\s+", " ", str(raw_doc.get("category") or "").strip())
        if category:
            group["categories"].append(category)
        group["aliases"].extend(raw_doc.get("aliases") or [])
        group["tags"].extend(raw_doc.get("tags") or [])
        if group.get("proficiency") is None and raw_doc.get("proficiency") is not None:
            group["proficiency"] = raw_doc.get("proficiency")
        if group.get("last_used_at") is None and raw_doc.get("last_used_at") is not None:
            group["last_used_at"] = raw_doc.get("last_used_at")

    merged_docs: list[dict] = []
    for group in grouped.values():
        merged_ids = unique_casefolded(group.pop("merged_ids", []))
        categories = unique_casefolded(group.pop("categories", []))
        aliases = expand_alias_variants(group.pop("aliases", []), base_name=group.get("name"))
        tags = unique_casefolded(group.pop("tags", []))
        name = str(group.get("name") or "").strip()
        name_key = normalize_skill_text(name)
        aliases = [alias for alias in aliases if normalize_skill_text(alias) != name_key]

        creator_ids = {cid for cid in group.pop("_creator_ids", set()) if cid}
        has_default = bool(group.pop("_has_default", False))
        can_delete = bool(
            current_user_oid
            and merged_ids
            and not has_default
            and creator_ids
            and creator_ids == {oid_str(current_user_oid)}
        )

        merged_docs.append(
            {
                **group,
                "aliases": aliases,
                "tags": tags,
                "categories": categories,
                "category": (categories[0] if categories else str(group.get("category") or "").strip()),
                "merged_ids": merged_ids,
                "origin": "default" if has_default else (group.get("origin") or "user"),
                "created_by_user_id": oid_str(current_user_oid) if can_delete else None,
                "can_delete": can_delete,
            }
        )

    return sorted(merged_docs, key=lambda doc: normalize_skill_text(doc.get("name")))
