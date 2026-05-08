import connectDB from "@/lib/db";
import Task from "@/models/Task";
import Comment from "@/models/Comment";
import Attachment from "@/models/Attachment";
import Project from "@/models/Project";
import ProjectMember from "@/models/ProjectMember";
import User from "@/models/User";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";

async function getSession() {
  const cookieStore = await cookies();
  const s = cookieStore.get("session")?.value;
  if (!s) return null;
  try { return await decrypt(s); } catch { return null; }
}

export async function POST(request) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let projectId, projectName;
  try {
    const body = await request.json();
    projectId = body.projectId;
    projectName = body.projectName;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  await connectDB();

  // Fetch project name if not provided
  if (!projectName) {
    try {
      const project = await Project.findById(projectId).lean();
      projectName = project?.title || "Untitled Project";
    } catch {
      projectName = "Untitled Project";
    }
  }

  // Get all active members of the project
  const members = await ProjectMember.find({
    projectId,
    status: "active",
  }).lean();

  // Resolve user details for each member
  const memberUsers = await Promise.all(
    members.map(async (member) => {
      const user = await User.findById(member.userId).select("name email").lean();
      return { ...member, user };
    })
  );

  // Build stats per member
  const memberStats = await Promise.all(
    memberUsers
      .filter((m) => m.user) // skip members with deleted accounts
      .map(async (member) => {
        const userId = member.userId.toString();

        // All tasks assigned to this member in this project
        const tasks = await Task.find({
          projectId,
          assignedTo: member.userId,
        }).lean();

        // Completed tasks (column === 'done')
        const completed = tasks.filter((t) => t.column === "done");

        // Since the Task model doesn't have completedAt or priority fields,
        // we approximate: tasks with deadline that were updated before deadline = on time
        const completedOnTime = completed.filter((t) =>
          t.deadline && t.updatedAt && new Date(t.updatedAt) <= new Date(t.deadline)
        );
        const completedLate = completed.filter((t) =>
          t.deadline && t.updatedAt && new Date(t.updatedAt) > new Date(t.deadline)
        );

        // Average completion days: from createdAt to updatedAt for done tasks
        const avgDays =
          completed.length > 0
            ? completed.reduce((sum, t) => {
                const days =
                  (new Date(t.updatedAt) - new Date(t.createdAt)) /
                  (1000 * 60 * 60 * 24);
                return sum + days;
              }, 0) / completed.length
            : 0;

        // In progress tasks
        const inProgress = tasks.filter((t) => t.column === "inprogress").length;

        // Preferred priority: since Task has no priority field, default to "medium"
        const preferredPriority = "medium";

        // Days since last activity (last comment, attachment, or task update)
        const taskIds = tasks.map((t) => t._id);

        const [latestComment, latestAttachment] = await Promise.all([
          Comment.findOne({ taskId: { $in: taskIds } })
            .sort({ createdAt: -1 })
            .select("createdAt")
            .lean(),
          Attachment.findOne({ taskId: { $in: taskIds } })
            .sort({ createdAt: -1 })
            .select("createdAt")
            .lean(),
        ]);

        const allDates = [
          ...tasks.map((t) => t.updatedAt),
          latestComment?.createdAt,
          latestAttachment?.createdAt,
        ].filter(Boolean);

        const lastActivity =
          allDates.length > 0
            ? Math.max(...allDates.map((d) => new Date(d).getTime()))
            : new Date(member.createdAt).getTime();

        const daysSinceActivity = Math.floor(
          (Date.now() - lastActivity) / (1000 * 60 * 60 * 24)
        );

        // Comments written by this user
        const commentsWritten = await Comment.countDocuments({
          taskId: { $in: taskIds },
          userId: userId,
        });

        // Files attached by this user
        const filesAttached = await Attachment.countDocuments({
          taskId: { $in: taskIds },
          uploadedBy: userId,
        });

        // On-time rate
        const completedWithDeadline = completed.filter((t) => t.deadline);
        const onTimeRate =
          completedWithDeadline.length > 0
            ? parseFloat(
                (completedOnTime.length / completedWithDeadline.length).toFixed(2)
              )
            : 0;

        return {
          memberId: userId,
          memberName: member.user.name || member.user.email || "Unknown",
          totalTasks: tasks.length,
          completedOnTime: completedOnTime.length,
          completedLate: completedLate.length,
          inProgress,
          avgCompletionDays: parseFloat(avgDays.toFixed(1)),
          preferredPriority,
          recentActivityDays: daysSinceActivity,
          commentsWritten,
          filesAttached,
          onTimeRate,
        };
      })
  );

  if (memberStats.length === 0) {
    return Response.json({
      profiles: [],
      message: "No active members with assigned tasks found.",
    });
  }

  // Call FastAPI microservice
  const serviceUrl = process.env.TEAM_PROFILER_URL || "http://localhost:8002";

  try {
    const aiResponse = await fetch(`${serviceUrl}/api/v1/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName, members: memberStats }),
      signal: AbortSignal.timeout(60000), // 60s timeout for multiple members
    });

    if (!aiResponse.ok) {
      throw new Error(`AI service responded with ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    return Response.json(aiData);
  } catch (error) {
    console.error("[team-profile] Microservice failed:", error.message);

    // Fallback: return member stats with default profile text
    const fallbackProfiles = memberStats.map((m) => {
      const rate = m.onTimeRate;
      let workStyle, strengths, suggestion;

      if (rate >= 0.80) {
        workStyle = "Reliable and consistent performer";
        strengths = "Strong deadline adherence, Dependable delivery";
        suggestion = "Trust with critical-path tasks";
      } else if (rate >= 0.50) {
        workStyle = "Steady contributor with room to improve";
        strengths = "Active participation, Growing consistency";
        suggestion = "Monitor deadlines more closely and provide support";
      } else {
        workStyle = "Needs additional support and guidance";
        strengths = "Willing participant, Potential for growth";
        suggestion = "Pair with a senior member and reduce workload";
      }

      return {
        ...m,
        workStyle,
        strengths,
        suggestion,
        summary: `${m.memberName} has completed ${m.totalTasks} tasks with a ${Math.round(rate * 100)}% on-time rate, averaging ${m.avgCompletionDays} days per task.`,
      };
    });

    return Response.json({ profiles: fallbackProfiles });
  }
}
