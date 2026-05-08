from pydantic import BaseModel, Field
from typing import List

class MemberProfile(BaseModel):
    """AI-generated profile for a single team member."""
    memberId: str
    memberName: str
    onTimeRate: float = Field(ge=0.0, le=1.0)
    totalTasks: int = Field(ge=0)
    avgCompletionDays: float = Field(ge=0.0)
    preferredPriority: str
    workStyle: str = Field(default="")
    strengths: str = Field(default="")
    suggestion: str = Field(default="")
    summary: str = Field(default="")

class TeamProfileResponse(BaseModel):
    """Response body containing profiles for all team members."""
    profiles: List[MemberProfile]
