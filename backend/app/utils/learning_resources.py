"""Local learning resource recommendations used to enrich skill-detail and career-path guidance."""

from __future__ import annotations

from typing import Iterable


RESOURCE_CATALOG: dict[str, list[dict[str, str]]] = {
    "python": [
        {"title": "Python Official Tutorial", "provider": "Python Docs", "url": "https://docs.python.org/3/tutorial/"},
        {"title": "Automate the Boring Stuff", "provider": "Free Book", "url": "https://automatetheboringstuff.com/"},
    ],
    "ml": [
        {"title": "Machine Learning Specialization", "provider": "DeepLearning.AI / Coursera", "url": "https://www.coursera.org/specializations/machine-learning-introduction"},
        {"title": "Hands-On Machine Learning", "provider": "O'Reilly", "url": "https://github.com/ageron/handson-ml3"},
    ],
    "machine learning": [
        {"title": "Machine Learning Specialization", "provider": "DeepLearning.AI / Coursera", "url": "https://www.coursera.org/specializations/machine-learning-introduction"},
        {"title": "Google Machine Learning Crash Course", "provider": "Google", "url": "https://developers.google.com/machine-learning/crash-course"},
    ],
    "fastapi": [
        {"title": "FastAPI Tutorial", "provider": "FastAPI Docs", "url": "https://fastapi.tiangolo.com/tutorial/"},
        {"title": "Build APIs with FastAPI", "provider": "freeCodeCamp", "url": "https://www.freecodecamp.org/news/fastapi-quickstart/"},
    ],
    "sql": [
        {"title": "SQLBolt", "provider": "SQLBolt", "url": "https://sqlbolt.com/"},
        {"title": "PostgreSQL Tutorial", "provider": "PostgreSQL", "url": "https://www.postgresql.org/docs/current/tutorial.html"},
    ],
    "analytics": [
        {"title": "Google Data Analytics Certificate", "provider": "Google / Coursera", "url": "https://www.coursera.org/professional-certificates/google-data-analytics"},
        {"title": "Data Visualization Curriculum", "provider": "freeCodeCamp", "url": "https://www.freecodecamp.org/learn/data-visualization/"},
    ],
}

CATEGORY_DEFAULTS: dict[str, list[dict[str, str]]] = {
    "Programming": [
        {"title": "CS50x", "provider": "Harvard / edX", "url": "https://cs50.harvard.edu/x/"},
    ],
    "Data": [
        {"title": "Kaggle Micro-Courses", "provider": "Kaggle", "url": "https://www.kaggle.com/learn"},
    ],
    "Backend": [
        {"title": "REST API Design Best Practices", "provider": "Microsoft", "url": "https://learn.microsoft.com/azure/architecture/best-practices/api-design"},
    ],
    "Cloud": [
        {"title": "AWS Skill Builder", "provider": "AWS", "url": "https://explore.skillbuilder.aws/learn"},
    ],
}


def recommended_resources(skill_name: str, category: str | None = None, limit: int = 3) -> list[dict[str, str]]:
    normalized = str(skill_name or "").strip().casefold()
    resources = list(RESOURCE_CATALOG.get(normalized, []))
    if not resources and category:
        resources = list(CATEGORY_DEFAULTS.get(str(category or "").strip(), []))
    return resources[:limit]


def recommended_resources_for_many(skills: Iterable[tuple[str, str]], limit: int = 4) -> list[dict[str, str]]:
    seen: set[tuple[str, str]] = set()
    out: list[dict[str, str]] = []
    for skill_name, category in skills:
        for resource in recommended_resources(skill_name, category, limit=limit):
            key = (resource.get("title", ""), resource.get("url", ""))
            if key in seen:
                continue
            seen.add(key)
            out.append(resource)
            if len(out) >= limit:
                return out
    return out
