import logging
from typing import List
from models.request import MemberStats, TeamProfileRequest
from models.response import MemberProfile, TeamProfileResponse
from repositories.llm_repository import LLMRepository
from prompts.profile_prompt import build_profile_prompt

logger = logging.getLogger(__name__)


class ProfileService:
    """
    Service/Business Logic Layer.
    Mirrors the Service Layer in the 5-layer architecture from the project report.
    Orchestrates prompt building, LLM calls, and response parsing.
    """

    def __init__(self, llm_repo: LLMRepository):
        self.llm_repo = llm_repo

    async def profile_team(self, request: TeamProfileRequest) -> TeamProfileResponse:
        """Generate AI profiles for all team members."""
        profiles: List[MemberProfile] = []

        for member in request.members:
            prompt = build_profile_prompt(request.projectName, member)
            ai_text = await self.llm_repo.call_gemma(prompt)
            profile = self._parse_ai_response(ai_text, member)
            profiles.append(profile)

        return TeamProfileResponse(profiles=profiles)

    def _parse_ai_response(self, text: str, member: MemberStats) -> MemberProfile:
        """
        Parse AI output and combine with raw stats.
        AI output format expected:
          STYLE: ...
          STRENGTHS: ...
          SUGGESTION: ...
          SUMMARY: ...
        Falls back to sensible defaults if parsing fails.
        """
        profile_data = {
            "memberId": member.memberId,
            "memberName": member.memberName,
            "onTimeRate": member.onTimeRate,
            "totalTasks": member.totalTasks,
            "avgCompletionDays": member.avgCompletionDays,
            "preferredPriority": member.preferredPriority,
            "workStyle": "",
            "strengths": "",
            "suggestion": "",
            "summary": "",
        }

        if not text:
            # LLM failed — generate rule-based fallback
            profile_data.update(self._generate_fallback(member))
            logger.warning(f"[ProfileService] Using fallback for {member.memberName}")
        else:
            lines = text.split("\n")
            for line in lines:
                line = line.strip()
                if line.startswith("STYLE:"):
                    profile_data["workStyle"] = line.replace("STYLE:", "").strip()
                elif line.startswith("STRENGTHS:"):
                    profile_data["strengths"] = line.replace("STRENGTHS:", "").strip()
                elif line.startswith("SUGGESTION:"):
                    profile_data["suggestion"] = line.replace("SUGGESTION:", "").strip()
                elif line.startswith("SUMMARY:"):
                    profile_data["summary"] = line.replace("SUMMARY:", "").strip()

            # If AI response was malformed, fill in fallback for empty fields
            if not profile_data["workStyle"]:
                fallback = self._generate_fallback(member)
                for key, val in fallback.items():
                    if not profile_data.get(key):
                        profile_data[key] = val

        return MemberProfile(**profile_data)

    def _generate_fallback(self, member: MemberStats) -> dict:
        """Rule-based fallback when LLM is unavailable or returns bad data."""
        rate = member.onTimeRate

        if rate >= 0.80:
            style = "Reliable and consistent performer"
            strengths = "Strong deadline adherence, Dependable delivery"
            suggestion = "Trust with critical-path tasks"
        elif rate >= 0.50:
            style = "Steady contributor with room to improve"
            strengths = "Active participation, Growing consistency"
            suggestion = "Monitor deadlines more closely and provide support"
        else:
            style = "Needs additional support and guidance"
            strengths = "Willing participant, Potential for growth"
            suggestion = "Pair with a senior member and reduce workload"

        summary = (
            f"{member.memberName} has completed {member.totalTasks} tasks "
            f"with a {int(rate * 100)}% on-time rate, "
            f"averaging {member.avgCompletionDays:.1f} days per task."
        )

        return {
            "workStyle": style,
            "strengths": strengths,
            "suggestion": suggestion,
            "summary": summary,
        }
