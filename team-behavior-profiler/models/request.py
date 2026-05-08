from pydantic import BaseModel, Field
from typing import List

class MemberStats(BaseModel):
    """Per-member statistics computed by the Next.js API route from MongoDB."""
    memberId: str = Field(..., description="MongoDB ObjectId of the user")
    memberName: str = Field(..., min_length=1)
    totalTasks: int = Field(ge=0, default=0)
    completedOnTime: int = Field(ge=0, default=0)
    completedLate: int = Field(ge=0, default=0)
    inProgress: int = Field(ge=0, default=0)
    avgCompletionDays: float = Field(ge=0.0, default=0.0)
    preferredPriority: str = Field(default="medium")
    recentActivityDays: int = Field(ge=0, default=0)
    commentsWritten: int = Field(ge=0, default=0)
    filesAttached: int = Field(ge=0, default=0)
    onTimeRate: float = Field(ge=0.0, le=1.0, default=0.0)

class TeamProfileRequest(BaseModel):
    """Request body for the team profiler endpoint."""
    projectName: str = Field(..., min_length=1, max_length=200)
    members: List[MemberStats] = Field(..., min_length=1)
