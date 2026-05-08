from models.request import MemberStats

def build_profile_prompt(project_name: str, member: MemberStats) -> str:
    """
    Build a structured prompt for Gemma 4 to analyze a team member's behavior.
    Instructs the model to respond in a strict STYLE/STRENGTHS/SUGGESTION/SUMMARY format.
    """
    return f"""You are an expert software team analyst.
Analyze this team member's behavior on the project "{project_name}" and return a structured profile.

Member: {member.memberName}
- Total tasks assigned: {member.totalTasks}
- Completed on time: {member.completedOnTime}
- Completed late: {member.completedLate}
- Currently in progress: {member.inProgress}
- Average completion time: {member.avgCompletionDays:.1f} days
- On-time delivery rate: {int(member.onTimeRate * 100)}%
- Preferred task priority: {member.preferredPriority}
- Days since last activity: {member.recentActivityDays}
- Comments written: {member.commentsWritten}
- Files attached: {member.filesAttached}

Respond in EXACTLY this format (one line each, no extra text):
STYLE: [one phrase describing their work style, e.g. "Fast executor who works best under pressure"]
STRENGTHS: [two or three strengths separated by commas, e.g. "Meets deadlines, Handles high-priority tasks well, Active communicator"]
SUGGESTION: [one actionable recommendation for team leader, e.g. "Assign critical-path tasks to this member"]
SUMMARY: [one sentence natural language summary of this member's behavior]
"""
