from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class JobIngestIn(BaseModel):
    user_id: str
    title: str | None = None
    company: str | None = None
    location: str | None = None
    text: str = Field(..., min_length=50, description="Full job posting text")


class ExtractedSkill(BaseModel):
    skill_id: str
    skill_name: str
    matched_on: str = Field(..., description="name|alias")
    count: int = 1


class JobIngestOut(BaseModel):
    id: str
    user_id: str
    title: str | None = None
    company: str | None = None
    location: str | None = None
    text_preview: str
    extracted_skills: list[ExtractedSkill]
    keywords: list[str]
    created_at: datetime | None = None


class MatchScoreBreakdown(BaseModel):
    label: str
    score: float
    detail: str


class RAGContextItem(BaseModel):
    source_type: str
    source_id: str
    title: str
    snippet: str
    score: float
    chunk_index: int = 0


class AddedFromMissingSkill(BaseModel):
    skill_id: str
    skill_name: str


class JobMatchOut(BaseModel):
    job_id: str
    match_score: float
    match_confidence_label: str = "Low"
    analysis_summary: str = ""
    resume_snapshot_id: str | None = None
    template_source: str | None = None
    ignored_skill_names: list[str] = Field(default_factory=list)
    added_from_missing_skills: list[AddedFromMissingSkill] = Field(default_factory=list)
    matched_skill_ids: list[str] = Field(default_factory=list)
    matched_skills: list[str] = Field(default_factory=list)
    missing_skill_ids: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    matched_skill_count: int = 0
    missing_skill_count: int = 0
    strength_areas: list[str] = Field(default_factory=list)
    related_skills: list[str] = Field(default_factory=list)
    semantic_alignment_examples: list[str] = Field(default_factory=list)
    retrieved_context: list[RAGContextItem] = Field(default_factory=list)
    score_breakdown: list[MatchScoreBreakdown] = Field(default_factory=list)
    recommended_next_steps: list[str] = Field(default_factory=list)
    extracted_skill_count: int = 0
    confirmed_skill_count: int = 0
    required_skill_count: int = 0
    required_matched_count: int = 0
    preferred_skill_count: int = 0
    preferred_matched_count: int = 0
    evidence_aligned_count: int = 0
    evidence_gap_count: int = 0
    keyword_overlap_count: int = 0
    keyword_overlap_terms: list[str] = Field(default_factory=list)
    semantic_alignment_score: float = 0
    semantic_alignment_explanation: str = ""
    history_id: str | None = None


class TailorPreviewIn(BaseModel):
    user_id: str
    job_id: str | None = Field(default=None, description="Job ingest id")
    job_text: str | None = Field(default=None, description="Optional job text if job_id not provided")
    resume_snapshot_id: str | None = Field(default=None, description="Optional resume snapshot to use as the tailoring template")
    ignored_skill_names: list[str] = Field(default_factory=list, description="Optional extracted job skills to ignore during tailoring")
    template: str = Field(default="ats_v1", description="Template name")
    max_items: int = Field(default=4, ge=1, le=10)
    max_bullets_per_item: int = Field(default=4, ge=1, le=10)


class ResumeSection(BaseModel):
    title: str
    lines: list[str]


class TailoredResumeOut(BaseModel):
    id: str
    user_id: str
    job_id: str | None = None
    resume_snapshot_id: str | None = None
    template_source: str | None = None
    template: str
    selected_skill_ids: list[str]
    selected_item_ids: list[str]
    retrieved_context: list[RAGContextItem] = Field(default_factory=list)
    sections: list[ResumeSection]
    plain_text: str
    created_at: datetime | None = None


class TailoredResumeListEntryOut(BaseModel):
    id: str
    user_id: str
    job_id: str | None = None
    job_title: str | None = None
    company: str | None = None
    location: str | None = None
    template: str
    selected_skill_count: int = 0
    selected_item_count: int = 0
    created_at: datetime | None = None


class TailoredResumeDetailOut(TailoredResumeOut):
    job_title: str | None = None
    company: str | None = None
    location: str | None = None
    selected_skill_count: int = 0
    selected_item_count: int = 0


class RewriteBulletsIn(BaseModel):
    focus: str = Field(default="balanced", description="impact|ats|balanced")


class RewriteBulletsOut(BaseModel):
    tailored_id: str
    provider: str
    focus: str
    rewritten_count: int
    sections: list[ResumeSection]
    plain_text: str
    updated_at: datetime | None = None


class JobMatchHistoryEntryOut(BaseModel):
    id: str
    job_id: str
    title: str | None = None
    company: str | None = None
    location: str | None = None
    match_score: float
    semantic_alignment_score: float = 0
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    strength_areas: list[str] = Field(default_factory=list)
    related_skills: list[str] = Field(default_factory=list)
    tailored_resume_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class JobMatchHistoryDetailOut(JobMatchHistoryEntryOut):
    text_preview: str | None = None
    job_text: str | None = None
    analysis: JobMatchOut


class JobMatchCompareOut(BaseModel):
    left: JobMatchHistoryEntryOut
    right: JobMatchHistoryEntryOut
    match_score_delta: float
    semantic_alignment_delta: float
    newly_matched_skills: list[str] = Field(default_factory=list)
    newly_missing_skills: list[str] = Field(default_factory=list)
    shared_strength_areas: list[str] = Field(default_factory=list)


class AISettingsStatusOut(BaseModel):
    provider_mode: str
    embeddings_provider: str
    rewrite_provider: str
    embedding_model: str
    rewrite_model: str


class AIPreferencesOut(BaseModel):
    inference_mode: str
    embedding_model: str
    zero_shot_model: str
    available_inference_modes: list[str] = Field(default_factory=list)
    available_embedding_models: list[str] = Field(default_factory=list)
    available_zero_shot_models: list[str] = Field(default_factory=list)


class AISettingsDetailOut(AISettingsStatusOut):
    preferences: AIPreferencesOut


class AIPreferencesPatchIn(BaseModel):
    inference_mode: str | None = None
    embedding_model: str | None = None
    zero_shot_model: str | None = None
