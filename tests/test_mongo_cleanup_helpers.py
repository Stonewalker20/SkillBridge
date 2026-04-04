from bson import ObjectId

from app.utils.job_records import derive_required_skills, hydrate_job_doc, normalize_extracted_skills, serialize_extracted_skill
from app.utils.portfolio_records import portfolio_dedupe_key, portfolio_item_to_evidence_doc, serialize_portfolio_doc


def test_normalize_extracted_skills_dedupes_by_skill_id():
    skill_id = str(ObjectId())
    duplicate = str(ObjectId())
    rows = normalize_extracted_skills(
        [
            {"skill_id": skill_id, "skill_name": "MongoDB", "matched_on": "name", "count": 1},
            {"skill_id": skill_id, "skill_name": "MongoDB", "matched_on": "alias", "count": 2},
            {"skill_id": duplicate, "skill_name": "FastAPI", "matched_on": "name", "count": 1},
        ]
    )

    assert len(rows) == 2
    assert str(rows[0]["skill_id"]) == skill_id
    assert rows[0]["count"] == 3
    assert str(rows[1]["skill_id"]) == duplicate


def test_derive_required_skills_returns_unique_names_and_object_ids():
    mongo_id = ObjectId()
    rows = [
        {"skill_id": mongo_id, "skill_name": "MongoDB"},
        {"skill_id": mongo_id, "skill_name": "MongoDB"},
        {"skill_id": ObjectId(), "skill_name": "FastAPI"},
    ]

    required_skills, required_skill_ids = derive_required_skills(rows)

    assert required_skills == ["MongoDB", "FastAPI"]
    assert required_skill_ids[0] == mongo_id
    assert len(required_skill_ids) == 2


def test_hydrate_job_doc_prefers_linked_ingest_fields():
    ingest_id = ObjectId()
    mongo_id = ObjectId()
    fastapi_id = ObjectId()
    hydrated = hydrate_job_doc(
        {
            "_id": ObjectId(),
            "title": "Legacy Title",
            "company": "Legacy Co",
            "role_ids": [str(ObjectId())],
            "job_ingest_id": ingest_id,
        },
        {
            "_id": ingest_id,
            "title": "Backend Engineer",
            "company": "Campus Lab",
            "location": "Detroit, MI",
            "text": "Build APIs with MongoDB and FastAPI.",
            "extracted_skills": [
                {"skill_id": mongo_id, "skill_name": "MongoDB", "matched_on": "name", "count": 1},
                {"skill_id": fastapi_id, "skill_name": "FastAPI", "matched_on": "name", "count": 1},
            ],
        },
    )

    assert hydrated["title"] == "Backend Engineer"
    assert hydrated["company"] == "Campus Lab"
    assert hydrated["location"] == "Detroit, MI"
    assert hydrated["required_skills"] == ["MongoDB", "FastAPI"]
    assert hydrated["required_skill_ids"] == [mongo_id, fastapi_id]


def test_serialize_extracted_skill_returns_string_id():
    skill_id = ObjectId()
    serialized = serialize_extracted_skill({"skill_id": skill_id, "skill_name": "MongoDB"})
    assert serialized == {
        "skill_id": str(skill_id),
        "skill_name": "MongoDB",
        "matched_on": "name",
        "count": 1,
    }


def test_portfolio_helpers_keep_structured_fields():
    portfolio_id = ObjectId()
    skill_id = ObjectId()
    doc = {
        "_id": portfolio_id,
        "user_id": str(ObjectId()),
        "type": "project",
        "title": "Resume Tailor Engine",
        "org": "SkillBridge",
        "summary": "Selection-based tailoring engine.",
        "bullets": ["Generated ATS-friendly resumes."],
        "links": ["https://example.com"],
        "skill_ids": [str(skill_id)],
        "tags": ["tailor"],
        "visibility": "private",
        "priority": 5,
        "created_at": None,
        "updated_at": None,
    }

    evidence_doc = portfolio_item_to_evidence_doc(doc, preserve_id=True)
    assert evidence_doc["_id"] == portfolio_id
    assert evidence_doc["structured_evidence"] is True
    assert evidence_doc["portfolio_item_type"] == "project"
    assert evidence_doc["skill_ids"] == [skill_id]
    assert portfolio_dedupe_key(evidence_doc) == str(portfolio_id)

    serialized = serialize_portfolio_doc(evidence_doc)
    assert serialized["id"] == str(portfolio_id)
    assert serialized["type"] == "project"
    assert serialized["skill_ids"] == [str(skill_id)]
