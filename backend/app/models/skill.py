from pydantic import BaseModel, Field
from typing import List

class SkillIn(BaseModel):
    name: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    aliases: List[str] = Field(default_factory=list)

class SkillOut(BaseModel):
    id: str
    name: str
    category: str
    aliases: List[str]

