# 🧠 Team Behavior Profiler — AI Feature 2
## Implementation Plan & Developer Walkthrough

> **Project:** Software Project Management System  
> **Feature:** AI Team Behavior Profiler  
> **Status:** 🔄 In Progress  
> **Model:** Gemma 4 (31B) via HuggingFace API  
> **Stack Compatibility:** Next.js 15 + FastAPI + MongoDB  
> **Author:** Development Team — Senior 1, 2026  

---

## 📌 Overview

The **Team Behavior Profiler** is the second AI microservice in the system.  
It analyzes how each team member behaves on the project board — their activity patterns, task types, response speed, and collaboration habits — then generates a natural language profile per member using **Gemma 4 via HuggingFace**.

The output appears as a **"Team Insights" page** inside the project dashboard, showing:
- A behavior summary card per member
- Strengths and preferred task types
- Workload balance visualization
- Smart assignment suggestions

---

## 🔗 How It Fits Into the Existing Architecture

```
Next.js Frontend (App Router)
        │
        │  POST /api/ai/team-profile
        ▼
Next.js API Route (proxy layer)
        │
        │  HTTP POST → localhost:8001/profile
        ▼
FastAPI Microservice (Python) ← port 8001
        │
        │  HuggingFace Inference API
        ▼
Gemma 4 (31B) — same model used in Risk Predictor
        │
        ▼
JSON Response → rendered in Next.js Team Insights Page
```

> ⚠️ **Important:** This follows the same microservices pattern as Feature 1 (Task Risk Predictor).  
> The Risk Predictor runs on **port 8000**, the Team Profiler runs on **port 8001**.

---

## 📁 File Structure

```
/
├── src/
│   ├── app/
│   │   ├── projects/
│   │   │   └── [id]/
│   │   │       ├── board/
│   │   │       │   └── page.js          ← existing board (already has Risk Predictor)
│   │   │       └── team-insights/
│   │   │           └── page.js          ← NEW: Team Insights Page
│   │   └── api/
│   │       └── ai/
│   │           ├── risk/
│   │           │   └── route.js         ← existing Risk Predictor proxy
│   │           └── team-profile/
│   │               └── route.js         ← NEW: Team Profiler proxy
│
├── ai-services/
│   ├── risk-predictor/                  ← existing FastAPI service (port 8000)
│   │   ├── main.py
│   │   └── requirements.txt
│   └── team-profiler/                   ← NEW FastAPI service (port 8001)
│       ├── main.py
│       ├── prompts.py
│       ├── analyzer.py
│       └── requirements.txt
```

---

## 🗄️ Data Input — What We Extract from MongoDB

For each team member, we collect the following from existing MongoDB collections:

### From `tasks` collection:
```js
// Fields we already store (from Junior 1):
{
  assignedTo: ObjectId,       // member
  status: "todo|inProgress|done",
  priority: "low|medium|high|critical",
  deadline: Date,
  createdAt: Date,
  completedAt: Date,          // when moved to Done column
  columnId: ObjectId,
  comments: [...],
  attachments: [...]
}
```

### Computed per member (in Next.js API route):
```js
const memberStats = {
  memberId: "...",
  memberName: "...",
  totalTasks: 12,
  completedOnTime: 8,
  completedLate: 2,
  inProgress: 2,
  avgCompletionDays: 4.5,
  preferredPriority: "high",     // most frequent
  taskTypeDistribution: {
    todo: 3,
    inProgress: 2,
    done: 10
  },
  recentActivityDays: 2,         // days since last comment or status change
  commentsWritten: 15,
  filesAttached: 3,
  onTimeRate: 0.80               // 8/10 completed tasks
}
```

---

## 🐍 FastAPI Microservice — `ai-services/team-profiler/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from prompts import build_profile_prompt
import httpx
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
GEMMA_MODEL = "google/gemma-4-31b-it"

class MemberStats(BaseModel):
    memberId: str
    memberName: str
    totalTasks: int
    completedOnTime: int
    completedLate: int
    inProgress: int
    avgCompletionDays: float
    preferredPriority: str
    recentActivityDays: int
    commentsWritten: int
    filesAttached: int
    onTimeRate: float

class TeamProfileRequest(BaseModel):
    projectName: str
    members: List[MemberStats]

@app.post("/profile")
async def profile_team(request: TeamProfileRequest):
    results = []

    for member in request.members:
        prompt = build_profile_prompt(request.projectName, member)

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"https://api-inference.huggingface.co/models/{GEMMA_MODEL}/v1/chat/completions",
                headers={"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"},
                json={
                    "model": GEMMA_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 300,
                    "temperature": 0.4
                }
            )

        data = response.json()
        ai_text = data["choices"][0]["message"]["content"].strip()
        parsed = parse_ai_response(ai_text, member)
        results.append(parsed)

    return {"profiles": results}


def parse_ai_response(text: str, member: MemberStats) -> dict:
    """
    Parse AI output and combine with raw stats.
    AI output format expected (see prompts.py):
      STYLE: ...
      STRENGTHS: ...
      SUGGESTION: ...
      SUMMARY: ...
    """
    lines = text.split("\n")
    profile = {
        "memberId": member.memberId,
        "memberName": member.memberName,
        "onTimeRate": member.onTimeRate,
        "totalTasks": member.totalTasks,
        "avgCompletionDays": member.avgCompletionDays,
        "preferredPriority": member.preferredPriority,
        "workStyle": "",
        "strengths": "",
        "suggestion": "",
        "summary": ""
    }

    for line in lines:
        if line.startswith("STYLE:"):
            profile["workStyle"] = line.replace("STYLE:", "").strip()
        elif line.startswith("STRENGTHS:"):
            profile["strengths"] = line.replace("STRENGTHS:", "").strip()
        elif line.startswith("SUGGESTION:"):
            profile["suggestion"] = line.replace("SUGGESTION:", "").strip()
        elif line.startswith("SUMMARY:"):
            profile["summary"] = line.replace("SUMMARY:", "").strip()

    return profile
```

---

## 📝 Prompt Engineering — `ai-services/team-profiler/prompts.py`

```python
def build_profile_prompt(project_name: str, member) -> str:
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
```

---

## 🔌 Next.js API Route — `src/app/api/ai/team-profile/route.js`

```js
// src/app/api/ai/team-profile/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Task from '@/models/Task';
import ProjectMember from '@/models/ProjectMember';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId, projectName } = await request.json();

  await connectDB();

  // Get all members of the project
  const members = await ProjectMember.find({ projectId }).populate('userId', 'name email');

  // Build stats per member
  const memberStats = await Promise.all(
    members.map(async (member) => {
      const tasks = await Task.find({
        projectId,
        assignedTo: member.userId._id
      });

      const completed = tasks.filter(t => t.status === 'done');
      const completedOnTime = completed.filter(t =>
        t.completedAt && t.deadline && t.completedAt <= t.deadline
      );
      const completedLate = completed.filter(t =>
        t.completedAt && t.deadline && t.completedAt > t.deadline
      );

      const avgDays = completed.length > 0
        ? completed.reduce((sum, t) => {
            const days = (new Date(t.completedAt) - new Date(t.createdAt)) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / completed.length
        : 0;

      // Most frequent priority
      const priorityCounts = tasks.reduce((acc, t) => {
        acc[t.priority] = (acc[t.priority] || 0) + 1;
        return acc;
      }, {});
      const preferredPriority = Object.keys(priorityCounts)
        .sort((a, b) => priorityCounts[b] - priorityCounts[a])[0] || 'medium';

      // Days since last activity (last comment or status update)
      const allDates = tasks.flatMap(t => [
        t.updatedAt,
        ...(t.comments || []).map(c => c.createdAt)
      ]).filter(Boolean);
      const lastActivity = allDates.length > 0
        ? Math.max(...allDates.map(d => new Date(d)))
        : new Date(member.createdAt);
      const daysSinceActivity = Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24));

      return {
        memberId: member.userId._id.toString(),
        memberName: member.userId.name,
        totalTasks: tasks.length,
        completedOnTime: completedOnTime.length,
        completedLate: completedLate.length,
        inProgress: tasks.filter(t => t.status === 'inProgress').length,
        avgCompletionDays: parseFloat(avgDays.toFixed(1)),
        preferredPriority,
        recentActivityDays: daysSinceActivity,
        commentsWritten: tasks.reduce((sum, t) => sum + (t.comments?.length || 0), 0),
        filesAttached: tasks.reduce((sum, t) => sum + (t.attachments?.length || 0), 0),
        onTimeRate: completed.length > 0
          ? parseFloat((completedOnTime.length / completed.length).toFixed(2))
          : 0
      };
    })
  );

  // Call FastAPI microservice
  const aiResponse = await fetch('http://localhost:8001/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName, members: memberStats })
  });

  if (!aiResponse.ok) {
    return NextResponse.json({ error: 'AI service error' }, { status: 500 });
  }

  const aiData = await aiResponse.json();
  return NextResponse.json(aiData);
}
```

---

## 🎨 Team Insights Page — `src/app/projects/[id]/team-insights/page.js`

```jsx
// src/app/projects/[id]/team-insights/page.js
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function TeamInsightsPage() {
  const { id } = useParams();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch('/api/ai/team-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: id,
            projectName: 'My Project' // replace with actual project name from context
          })
        });

        if (!res.ok) throw new Error('Failed to fetch profiles');
        const data = await res.json();
        setProfiles(data.profiles);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProfiles();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500">Analyzing team behavior with AI...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-6 text-red-600 bg-red-50 rounded-xl">
      Error: {error}
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">👥 Team Insights</h1>
      <p className="text-gray-500 mb-8">
        AI-powered behavior analysis for each team member, powered by Gemma 4.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {profiles.map((profile) => (
          <MemberCard key={profile.memberId} profile={profile} />
        ))}
      </div>
    </div>
  );
}

function MemberCard({ profile }) {
  const onTimePercent = Math.round(profile.onTimeRate * 100);

  const riskColor =
    onTimePercent >= 75 ? 'bg-green-100 text-green-700' :
    onTimePercent >= 50 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-700';

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">{profile.memberName}</h2>
          <p className="text-sm text-gray-400 italic">{profile.workStyle}</p>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${riskColor}`}>
          {onTimePercent}% on-time
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBadge label="Total Tasks" value={profile.totalTasks} />
        <StatBadge label="Avg Days" value={profile.avgCompletionDays} />
        <StatBadge label="Priority" value={profile.preferredPriority} capitalize />
      </div>

      {/* AI Analysis */}
      <div className="space-y-3">
        <InfoRow icon="💪" label="Strengths" value={profile.strengths} />
        <InfoRow icon="💡" label="Suggestion" value={profile.suggestion} />
        <div className="mt-3 p-3 bg-blue-50 rounded-xl text-sm text-blue-800 border border-blue-100">
          🤖 <span className="font-medium">AI Summary:</span> {profile.summary}
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, value, capitalize }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className={`text-lg font-bold text-gray-800 ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex gap-2 text-sm">
      <span>{icon}</span>
      <div>
        <span className="font-semibold text-gray-700">{label}: </span>
        <span className="text-gray-600">{value}</span>
      </div>
    </div>
  );
}
```

---

## ⚙️ requirements.txt — `ai-services/team-profiler/requirements.txt`

```
fastapi==0.111.0
uvicorn==0.30.0
httpx==0.27.0
pydantic==2.7.0
python-dotenv==1.0.1
```

---

## 🚀 Running the Microservice

```bash
# Navigate to the team profiler service
cd ai-services/team-profiler

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "HUGGINGFACE_API_KEY=your_key_here" > .env

# Run on port 8001
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

---

## 🔁 How It Compares to Feature 1 (Risk Predictor)

| | Task Risk Predictor (Feature 1) | Team Behavior Profiler (Feature 2) |
|---|---|---|
| **Port** | 8000 | 8001 |
| **Input** | Per-task signals (deadline, workload, activity) | Per-member stats (on-time rate, task count, activity) |
| **Output** | Risk badge per task (🔴🟡🟢) | Text profile per member |
| **Trigger** | When board opens | When "Team Insights" page opens |
| **Model** | Gemma 4 (31B) | Gemma 4 (31B) — same model |
| **Status** | ✅ Done | 🔄 In Progress |

---

## ✅ Implementation Checklist

- [ ] Create `ai-services/team-profiler/` folder with `main.py`, `prompts.py`, `requirements.txt`
- [ ] Create Next.js API route: `src/app/api/ai/team-profile/route.js`
- [ ] Create Team Insights page: `src/app/projects/[id]/team-insights/page.js`
- [ ] Add "Team Insights" button/link to the project board navbar (next to the board view)
- [ ] Test FastAPI locally with sample JSON data
- [ ] Test full flow: board → API route → FastAPI → Gemma 4 → response → UI
- [ ] Handle loading states and error states in the UI
- [ ] Add HuggingFace API key to `.env` (same key used in Risk Predictor)

---

## 💡 Tips for the Team

1. **Reuse the same `.env` file** — The `HUGGINGFACE_API_KEY` is already set up for Feature 1. Use the same key for Feature 2.
2. **Run both services at the same time** — Risk Predictor on `:8000`, Team Profiler on `:8001`. They are independent.
3. **If Gemma 4 is slow** — Reduce `max_tokens` to 200 in `main.py`. The structured format (STYLE/STRENGTHS/SUGGESTION/SUMMARY) keeps responses short.
4. **MongoDB queries are already written** — All the data we need (tasks, assignedTo, deadline, completedAt) was stored in Junior 1. No schema changes needed.
5. **Start with the FastAPI service first** — Test it with Postman/curl before touching the Next.js side.

---

*Generated for Senior 1 — Software Project Management System — 2026*
