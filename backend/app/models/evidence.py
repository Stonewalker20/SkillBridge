from pydantic import BaseModel, Field
from typing import List, Literal, Optional

EvidenceType = Literal["resume", "paper", "job_posting", "project", "cert"]

class EvidenceIn(BaseModel):
    user_email: str = Field(..., min_length=3)
    type: EvidenceType
    title: str = Field(..., min_length=1)
    source: str = Field(..., min_length=1)
    text_excerpt: str = Field(..., min_length=1)
    tags: List[str] = Field(default_factory=list)

class EvidenceOut(BaseModel):
    id: str
    user_email: str
    type: EvidenceType
    title: str
    source: str
    text_excerpt: str
    tags: List[str]

