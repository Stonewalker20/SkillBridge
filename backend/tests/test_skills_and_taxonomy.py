def test_skill_crud_and_taxonomy_routes(test_context):
    client = test_context["client"]
    headers = test_context["headers"]

    listed = client.get("/skills/", headers=headers)
    assert listed.status_code == 200
    assert any(skill["name"] == "Python" for skill in listed.json())

    created = client.post(
        "/skills/",
        headers=headers,
        json={"name": "FastAPI", "category": "Backend", "aliases": ["fast api"], "tags": ["python"]},
    )
    assert created.status_code == 200
    skill_id = created.json()["id"]

    updated = client.patch(f"/skills/{skill_id}", json={"aliases": ["Fast APIs"], "proficiency": 4})
    assert updated.status_code == 200
    assert updated.json()["proficiency"] == 4

    aliases = client.put(f"/taxonomy/aliases/{skill_id}", json={"aliases": ["fastapi", "fast apis"]})
    assert aliases.status_code == 200
    assert aliases.json()["aliases"]

    relation = client.post(
        "/taxonomy/relations",
        json={"from_skill_id": test_context["skill_python"], "to_skill_id": skill_id, "relation_type": "related_to"},
    )
    assert relation.status_code == 200

    relations = client.get("/taxonomy/relations", params={"skill_id": test_context["skill_python"]})
    assert relations.status_code == 200
    assert len(relations.json()) == 1

    deleted = client.delete(f"/skills/{skill_id}", headers=headers)
    assert deleted.status_code == 200


def test_skill_extraction_and_gap_endpoints(test_context):
    client = test_context["client"]
    db = test_context["db"]

    snapshot_id = db["resume_snapshots"].docs[0]["_id"] if db["resume_snapshots"].docs else None
    if snapshot_id is None:
        db["resume_snapshots"].docs.append(
            {
                "_id": __import__("bson").ObjectId(),
                "user_id": __import__("bson").ObjectId(test_context["user_id"]),
                "raw_text": "Python ML FastAPI " * 20,
                "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
            }
        )
        snapshot_id = db["resume_snapshots"].docs[0]["_id"]

    extracted = client.post(f"/skills/extract/skills/{snapshot_id}")
    assert extracted.status_code == 200
    assert extracted.json()["extracted"]

    gaps = client.get("/skills/gaps")
    assert gaps.status_code == 200
    assert isinstance(gaps.json(), list)
