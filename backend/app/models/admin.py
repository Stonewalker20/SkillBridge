"""Pydantic schemas that shape admin dashboard responses and role update payloads."""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class AdminUserOut(BaseModel):
    id: str
    email: str
    username: str
    role: str = "user"
    is_active: bool = True
    created_at: datetime | None = None
    deactivated_at: datetime | None = None


class AdminUserRolePatch(BaseModel):
    role: str = Field(..., min_length=1)


class AdminJobOut(BaseModel):
    id: str
    title: str
    company: str
    location: str
    source: str
    description_excerpt: str
    description_full: str | None = None
    moderation_status: str
    moderation_reason: str | None = None
    submitted_by_user_id: str | None = None
    role_ids: list[str] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AdminSkillOut(BaseModel):
    id: str
    name: str
    category: str
    aliases: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    origin: str = "default"
    hidden: bool = False
    created_by_user_id: str | None = None
    evidence_count: int = 0
    project_link_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AdminHelpRequestOut(BaseModel):
    id: str
    user_id: str
    user_email: str | None = None
    username: str | None = None
    category: str
    subject: str
    message: str
    page: str | None = None
    status: str
    admin_response: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AdminHelpRequestPatch(BaseModel):
    status: str = Field(..., min_length=1, max_length=40)
    admin_response: str | None = Field(default=None, max_length=2000)


class AdminSummaryOut(BaseModel):
    total_users: int
    team_members: int
    projects: int
    evidence: int
    jobs: int
    pending_jobs: int
    skills: int
    tailored_resumes: int
    provider_mode: str
    collections: dict[str, int] = Field(default_factory=dict)


class AdminMlflowRunOut(BaseModel):
    run_id: str
    run_name: str
    status: str
    experiment_id: str
    artifact_uri: str = ""
    start_time: datetime | None = None
    end_time: datetime | None = None
    duration_seconds: float | None = None
    metrics: dict[str, float] = Field(default_factory=dict)
    params: dict[str, str] = Field(default_factory=dict)
    tags: dict[str, str] = Field(default_factory=dict)
    primary_metric_key: str | None = None
    primary_metric_value: float | None = None


class AdminMlflowExperimentOut(BaseModel):
    id: str
    name: str
    lifecycle_stage: str
    creation_time: datetime | None = None
    last_update_time: datetime | None = None
    run_count: int = 0
    latest_run_started_at: datetime | None = None
    latest_runs: list[AdminMlflowRunOut] = Field(default_factory=list)


class AdminMlflowModelVersionOut(BaseModel):
    name: str
    version: str
    current_stage: str
    run_id: str
    source: str
    creation_timestamp: datetime | None = None


class AdminMlflowRegisteredModelOut(BaseModel):
    name: str
    description: str | None = None
    latest_versions: list[AdminMlflowModelVersionOut] = Field(default_factory=list)


class AdminMlflowOverviewOut(BaseModel):
    available: bool = False
    tracking_uri: str
    experiment_count: int = 0
    registered_model_count: int = 0
    latest_run_started_at: datetime | None = None
    experiments: list[AdminMlflowExperimentOut] = Field(default_factory=list)
    registered_models: list[AdminMlflowRegisteredModelOut] = Field(default_factory=list)
    error: str | None = None


class AdminMlflowArtifactOut(BaseModel):
    path: str
    is_dir: bool = False
    file_size: int | None = None


class AdminMlflowRunDetailOut(AdminMlflowRunOut):
    parent_run_id: str | None = None
    child_runs: list[AdminMlflowRunOut] = Field(default_factory=list)
    artifacts: list[AdminMlflowArtifactOut] = Field(default_factory=list)


class AdminMlflowDatasetOut(BaseModel):
    id: str
    label: str
    kind: str
    path: str
    manifest_path: str | None = None
    extraction_dataset: str | None = None
    ranking_dataset: str | None = None
    rewrite_dataset: str | None = None
    created_at: datetime | None = None
    counts: dict[str, int] = Field(default_factory=dict)


class AdminMlflowJobOut(BaseModel):
    id: str
    kind: str
    status: str
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    command: list[str] = Field(default_factory=list)
    summary: dict[str, str] = Field(default_factory=dict)
    log_lines: list[str] = Field(default_factory=list)
    return_code: int | None = None
    error: str | None = None


class AdminMlflowPresetOut(BaseModel):
    id: str
    label: str
    description: str
    inference_modes: list[str] = Field(default_factory=list)
    embedding_models: list[str] = Field(default_factory=list)
    zero_shot_models: list[str] = Field(default_factory=list)
    rewrite_models: list[str] = Field(default_factory=list)


class AdminMlflowLocalOptionsOut(BaseModel):
    available_inference_modes: list[str] = Field(default_factory=list)
    embedding_models: list[str] = Field(default_factory=list)
    zero_shot_models: list[str] = Field(default_factory=list)
    rewrite_models: list[str] = Field(default_factory=list)
    default_inference_mode: str
    default_embedding_model: str
    default_zero_shot_model: str
    default_rewrite_model: str
    presets: list[AdminMlflowPresetOut] = Field(default_factory=list)


class AdminMlflowRunLaunchIn(BaseModel):
    experiment_name: str = Field(..., min_length=1, max_length=120)
    run_name: str | None = Field(default=None, max_length=120)
    dataset_id: str | None = Field(default="bundled-samples", max_length=160)
    inference_modes: list[str] = Field(default_factory=lambda: ["auto"])
    embedding_models: list[str] = Field(default_factory=lambda: ["sentence-transformers/all-MiniLM-L6-v2"])
    zero_shot_models: list[str] = Field(default_factory=lambda: ["MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33"])
    rewrite_models: list[str] = Field(default_factory=lambda: ["google/flan-t5-small"])
    max_candidates: int = Field(default=25, ge=1, le=250)
    top_k: list[int] = Field(default_factory=lambda: [1, 3, 5])
    skip_extraction: bool = False
    skip_ranking: bool = False
    skip_rewrite: bool = False
    tags: dict[str, str] = Field(default_factory=dict)


class AdminMlflowExportLaunchIn(BaseModel):
    max_users: int = Field(default=150, ge=1, le=1000)
    max_per_user: int = Field(default=6, ge=1, le=20)
    negative_count: int = Field(default=3, ge=1, le=10)
    mongo_db: str | None = Field(default=None, max_length=120)
