from fastapi import APIRouter, Depends, HTTPException, status
from models.request import TeamProfileRequest
from models.response import TeamProfileResponse
from services.profile_service import ProfileService
from repositories.llm_repository import LLMRepository

router = APIRouter(tags=["Team Profiling"])

def get_profile_service() -> ProfileService:
    """Dependency injection — clean, testable, mirrors project's service layer."""
    return ProfileService(llm_repo=LLMRepository())

@router.post(
    "/profile",
    response_model=TeamProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI behavior profiles for team members",
    description=(
        "Accepts per-member statistics computed by Next.js and returns "
        "AI-generated behavior profiles including work style, strengths, "
        "suggestions, and a natural language summary for each member."
    )
)
async def profile_team(
    request: TeamProfileRequest,
    service: ProfileService = Depends(get_profile_service)
):
    try:
        return await service.profile_team(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Team profiling failed: {str(e)}"
        )
