from pydantic import BaseModel, Field
from typing import List

class JobIn(BaseModel):
    title: str = Field(..., min_length=1)
    company: str = Field(..., min_length=1)
    location: str = Field(..., min_length=1)
    source: str = Field(..., min_length=1)
    description_excerpt: str = Field(..., min_length=1)
    required_skills: List[str] = Field(default_factory=list)

class JobOut(BaseModel):
    id: str
    title: str
    company: str
    location: str
    source: str
    description_excerpt: str
    required_skills: List[str]

