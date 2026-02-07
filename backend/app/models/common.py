from pydantic import BaseModel, Field

class MongoOut(BaseModel):
    id: str = Field(..., description="MongoDB ObjectId as string")

