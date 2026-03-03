from datetime import datetime, timezone

from app.models.auth import RegisterIn, LoginIn, UserOut, AuthOut, UserPatch
from app.models.skill import SkillIn, SkillOut, SkillUpdate
from app.models.resume import ResumeSnapshotIn, ResumeSnapshotOut, ResumeSnapshotDB
from app.models.confirmations import (
    ConfirmedSkillEntry,
    RejectedSkill,
    EditedSkill,
    ConfirmationIn,
    ConfirmationOut,
)
from app.models.job import JobIn, JobOut, JobModerationIn, JobRoleTagIn
from app.models.role import RoleIn, RoleOut, RoleTagIn, RoleWeightsOut
from app.models.common import MongoOut
from app.models.extraction import ExtractedSkill as ExtractedSkillV1, SkillExtractionOut
from app.models.taxonomy import SkillAliasesUpdate, SkillRelationIn, SkillRelationOut
from app.models.tailor import JobIngestIn, JobIngestOut, TailorPreviewIn, ResumeSection, TailoredResumeOut
from app.models.evidence import EvidenceIn, EvidenceOut
from app.models.portfolio import PortfolioItemIn, PortfolioItemPatch, PortfolioItemOut
from app.models.project import ProjectIn, ProjectOut, ProjectSkillLinkIn, ProjectSkillLinkOut


def test_auth_models_validate():
    reg = RegisterIn(email="a@b.com", username="user", password="Password123")
    login = LoginIn(email="a@b.com", password="Password123")
    user = UserOut(id="507f1f77bcf86cd799439011", email="a@b.com", username="user", role="user")
    out = AuthOut(token="t" * 10, user=user)
    patch = UserPatch(username="user2")
    assert reg.email == "a@b.com"
    assert login.password
    assert out.user.id
    assert patch.username == "user2"


def test_skill_models_validate():
    s_in = SkillIn(name="Python", category="language", aliases=["py"], tags=["ml"], proficiency=4)
    s_out = SkillOut(id="507f1f77bcf86cd799439011", **s_in.model_dump())
    upd = SkillUpdate(proficiency=5)
    assert s_in.name == "Python"
    assert s_out.aliases == ["py"]
    assert upd.proficiency == 5


def test_resume_models_validate():
    snap_in = ResumeSnapshotIn(text="hello world")
    snap_out = ResumeSnapshotOut(snapshot_id="507f1f77bcf86cd799439011", preview="hello")
    snap_db = ResumeSnapshotDB(
        user_id="student1",
        source_type="paste",
        raw_text="hello world",
        metadata={},
        image_ref="resume_icon.png",
        created_at=datetime.now(timezone.utc),
    )
    assert snap_in.user_id
    assert snap_out.preview
    assert snap_db.source_type == "paste"


def test_confirmation_models_validate():
    c = ConfirmedSkillEntry(skill_id="1", skill_name="Python", proficiency=3)
    r = RejectedSkill(skill_id="2", skill_name="Cobol")
    e = EditedSkill(from_text="py", to_skill_id="1")
    c_in = ConfirmationIn(user_id="u1", resume_snapshot_id="s1", confirmed=[c], rejected=[r], edited=[e])
    c_out = ConfirmationOut(id="c1", **c_in.model_dump())
    assert c_out.confirmed[0].skill_name == "Python"


def test_job_models_validate():
    j_in = JobIn(
        title="ML Engineer",
        company="ACME",
        location="Remote",
        source="manual",
        description_excerpt="desc",
        required_skills=["Python"],
    )
    j_out = JobOut(id="j1", **j_in.model_dump())
    mod = JobModerationIn(moderation_status="approved")
    tag = JobRoleTagIn(role_id="r1")
    assert j_out.moderation_status == "approved"
    assert mod.moderation_status in ("approved", "pending", "rejected")
    assert tag.role_id == "r1"


def test_role_models_validate():
    r_in = RoleIn(name="Data Scientist", description="")
    r_out = RoleOut(id="r1", **r_in.model_dump())
    tag = RoleTagIn(role_id="r1")
    weights = RoleWeightsOut(role_id="r1", computed_at=datetime.now(timezone.utc), weights=[])
    assert r_out.name == "Data Scientist"
    assert tag.role_id == "r1"
    assert isinstance(weights.weights, list)


def test_common_models_validate():
    m = MongoOut(id="507f1f77bcf86cd799439011")
    assert len(m.id) > 0


def test_extraction_models_validate():
    s = ExtractedSkillV1(skill_id="1", skill_name="Python", confidence=0.9, evidence_snippet="...")
    out = SkillExtractionOut(snapshot_id="s1", extracted=[s], created_at=datetime.now(timezone.utc))
    assert out.extracted[0].confidence == 0.9


def test_taxonomy_models_validate():
    a = SkillAliasesUpdate(aliases=["py"])
    rel_in = SkillRelationIn(from_skill_id="1", to_skill_id="2", relation_type="related_to")
    rel_out = SkillRelationOut(id="rel1", **rel_in.model_dump())
    assert a.aliases == ["py"]
    assert rel_out.relation_type == "related_to"


def test_tailor_models_validate():
    j = JobIngestIn(user_id="u1", text="x" * 60)
    prev = TailorPreviewIn(user_id="u1", job_text="x" * 60)
    sec = ResumeSection(title="Skills", lines=["Python"])
    out = TailoredResumeOut(
        id="t1",
        user_id="u1",
        template="ats_v1",
        selected_skill_ids=[],
        selected_item_ids=[],
        sections=[sec],
        plain_text="...",
        created_at=datetime.now(timezone.utc),
    )
    ingest_out = JobIngestOut(
        id="j1",
        user_id="u1",
        text_preview="...",
        extracted_skills=[],
        keywords=[],
        created_at=datetime.now(timezone.utc),
    )
    assert j.user_id == "u1"
    assert prev.max_items >= 1
    assert out.sections[0].title == "Skills"
    assert ingest_out.id


def test_evidence_models_validate():
    e_in = EvidenceIn(user_id="u1", type="project", title="Capstone", source="repo", text_excerpt="...")
    e_out = EvidenceOut(id="e1", **e_in.model_dump())
    assert e_out.type == "project"


def test_portfolio_models_validate():
    p_in = PortfolioItemIn(user_id="u1", type="project", title="SkillBridge")
    p_patch = PortfolioItemPatch(title="SkillBridge v2")
    p_out = PortfolioItemOut(id="p1", **p_in.model_dump())
    assert p_patch.title == "SkillBridge v2"
    assert p_out.title == "SkillBridge"


def test_project_models_validate():
    pr_in = ProjectIn(user_id="u1", title="Proj", description="")
    pr_out = ProjectOut(id="pr1", **pr_in.model_dump())
    link_in = ProjectSkillLinkIn(skill_id="s1")
    link_out = ProjectSkillLinkOut(id="l1", project_id="pr1", skill_id="s1")
    assert pr_out.user_id == "u1"
    assert link_in.skill_id == "s1"
    assert link_out.project_id == "pr1"
