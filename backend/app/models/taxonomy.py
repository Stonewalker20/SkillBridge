"""Pydantic schemas for skill alias management, graph relationships, and trajectory analytics."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, List
from pydantic import BaseModel, Field

RelationType = Literal["related_to", "parent_of", "child_of", "similar_to"]
GraphEdgeType = Literal["explicit", "semantic", "evidence_cooccurrence", "job_cooccurrence"]

class SkillAliasesUpdate(BaseModel):
    aliases: List[str] = Field(default_factory=list)

class SkillRelationIn(BaseModel):
    from_skill_id: str = Field(..., min_length=1)
    to_skill_id: str = Field(..., min_length=1)
    relation_type: RelationType = "related_to"

class SkillRelationOut(BaseModel):
    id: str
    from_skill_id: str
    to_skill_id: str
    relation_type: RelationType
    created_at: Optional[datetime] = None


class SkillGraphNode(BaseModel):
    skill_id: str
    name: str
    category: str = ""
    aliases: List[str] = Field(default_factory=list)
    distance: int = 0
    node_type: Literal["seed", "neighbor"] = "neighbor"


class SkillGraphEdge(BaseModel):
    source_skill_id: str
    target_skill_id: str
    relation_type: str
    edge_type: GraphEdgeType = "explicit"
    weight: float = 0.0


class SkillGraphOut(BaseModel):
    root_skill_id: str
    nodes: List[SkillGraphNode] = Field(default_factory=list)
    edges: List[SkillGraphEdge] = Field(default_factory=list)


class SkillTrajectoryCluster(BaseModel):
    category: str
    skill_count: int = 0
    evidence_backed_count: int = 0
    average_proficiency: float = 0.0
    skill_names: List[str] = Field(default_factory=list)


class SkillTrajectoryPath(BaseModel):
    role_id: str
    role_name: str
    score: float = 0.0
    confidence_label: str = "Low"
    cluster_category: str = ""
    personal_vector_alignment_score: float = 0.0
    progress_bonus_score: float = 0.0
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    top_role_skills: List[str] = Field(default_factory=list)
    reasoning: str = ""
    next_steps: List[str] = Field(default_factory=list)


class LearningPathRecommendation(BaseModel):
    phase: str
    title: str
    target_skills: List[str] = Field(default_factory=list)
    rationale: str = ""
    evidence_action: str = ""


class SkillTrajectoryOut(BaseModel):
    generated_at: Optional[datetime] = None
    clusters: List[SkillTrajectoryCluster] = Field(default_factory=list)
    career_paths: List[SkillTrajectoryPath] = Field(default_factory=list)
    learning_path: List[LearningPathRecommendation] = Field(default_factory=list)


class LearningPathProgressOut(BaseModel):
    skill_name: str
    status: Literal["not_started", "in_progress", "completed"] = "not_started"
    updated_at: Optional[datetime] = None


class LearningPathProgressPatchIn(BaseModel):
    skill_name: str = Field(..., min_length=1)
    status: Literal["not_started", "in_progress", "completed"] = "in_progress"


class LearningPathSkillDetailOut(BaseModel):
    skill_name: str
    skill_id: Optional[str] = None
    confirmed: bool = False
    evidence_support_count: int = 0
    graph_neighbors: List[str] = Field(default_factory=list)
    related_career_paths: List[str] = Field(default_factory=list)
    recommended_projects: List[str] = Field(default_factory=list)
    recommended_resources: List[dict[str, str]] = Field(default_factory=list)
    progress_status: Literal["not_started", "in_progress", "completed"] = "not_started"


class CareerPathDetailOut(BaseModel):
    role_id: str
    role_name: str
    score: float = 0.0
    confidence_label: str = "Low"
    cluster_category: str = ""
    personal_vector_alignment_score: float = 0.0
    progress_bonus_score: float = 0.0
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    top_role_skills: List[str] = Field(default_factory=list)
    graph_neighbor_skills: List[str] = Field(default_factory=list)
    recommended_skills_to_add: List[str] = Field(default_factory=list)
    recommended_project_ideas: List[str] = Field(default_factory=list)
    recommended_resources: List[dict[str, str]] = Field(default_factory=list)
    reasoning: str = ""
