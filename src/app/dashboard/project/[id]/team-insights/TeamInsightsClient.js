'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TeamInsightsClient({ project }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch('/api/team-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            projectName: project.title,
          }),
        });

        if (!res.ok) throw new Error('Failed to fetch team profiles');
        const data = await res.json();
        setProfiles(data.profiles || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProfiles();
  }, [project.id, project.title]);

  return (
    <>
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#3d348b] via-[#5b4fa3] to-[#1a1640]">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#78e0dc] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-float"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#ff8d4c] rounded-full mix-blend-screen filter blur-[120px] opacity-15 animate-float-delayed"></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-[#78e0dc] rounded-full mix-blend-screen filter blur-[120px] opacity-10 animate-pulse-slow"></div>
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

        {/* Premium Header */}
        <header className="relative z-20 border-b border-white/10 backdrop-blur-xl bg-white/5 sticky top-0">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
            <div className="flex items-center gap-4">
              <Link
                href={`/dashboard/project/${project.id}`}
                className="group flex items-center gap-2 rounded-xl px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300"
              >
                <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-semibold">Board</span>
              </Link>

              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#78e0dc] to-[#ff8d4c] animate-spin-slow opacity-80"></div>
                <div className="absolute inset-[2px] rounded-xl bg-gradient-to-br from-[#3d348b] to-[#1a1640] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#78e0dc]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>

              <div>
                <h1 className="text-xl font-black text-white tracking-tight">{project.title}</h1>
                <p className="text-xs text-white/60 font-medium">Team Insights — AI Analysis</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8">
          {/* Page Title Section */}
          <div className="mb-8 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#78e0dc]/20 to-[#ff8d4c]/20 border border-white/10 flex items-center justify-center backdrop-blur-sm">
                <span className="text-xl">🧠</span>
              </div>
              <h2 className="text-2xl font-black text-white">Team Insights</h2>
            </div>
            <p className="text-white/50 text-sm ml-[52px]">
              AI-powered behavior analysis for each team member, powered by Gemma 4.
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="relative bg-gradient-to-br from-white/[0.10] to-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 p-6 animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-full bg-white/10"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-white/10 rounded-lg w-32 mb-2"></div>
                      <div className="h-3 bg-white/5 rounded-lg w-48"></div>
                    </div>
                    <div className="h-7 bg-white/10 rounded-full w-20"></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-16 bg-white/5 rounded-xl"></div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 bg-white/5 rounded-lg w-full"></div>
                    <div className="h-3 bg-white/5 rounded-lg w-3/4"></div>
                    <div className="h-12 bg-white/5 rounded-xl mt-3"></div>
                  </div>
                </div>
              ))}
              <div className="col-span-full flex items-center justify-center py-4">
                <div className="flex items-center gap-3 text-white/50">
                  <div className="w-5 h-5 border-2 border-[#78e0dc]/40 border-t-[#78e0dc] rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">Analyzing team behavior with AI...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="animate-fade-in-up">
              <div className="relative bg-gradient-to-br from-red-500/10 to-red-900/10 backdrop-blur-xl rounded-2xl border border-red-500/20 p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-red-300 mb-2">Analysis Failed</h3>
                <p className="text-red-200/70 text-sm mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-200 text-sm font-semibold transition-all duration-300 hover:scale-105"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && profiles.length === 0 && (
            <div className="animate-fade-in-up">
              <div className="relative bg-gradient-to-br from-white/[0.10] to-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-[#78e0dc]/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-[#78e0dc]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white/70 mb-2">No Team Members Found</h3>
                <p className="text-white/40 text-sm">
                  Add members to this project and assign tasks to see AI-powered insights.
                </p>
              </div>
            </div>
          )}

          {/* Profile Cards Grid */}
          {!loading && !error && profiles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {profiles.map((profile, index) => (
                <MemberCard key={profile.memberId} profile={profile} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MemberCard({ profile, index }) {
  const onTimePercent = Math.round(profile.onTimeRate * 100);

  const badgeConfig =
    onTimePercent >= 75
      ? {
          bg: 'bg-emerald-500/15',
          border: 'border-emerald-400/30',
          text: 'text-emerald-300',
          dot: 'bg-emerald-400',
          label: 'Excellent',
        }
      : onTimePercent >= 50
        ? {
            bg: 'bg-amber-500/15',
            border: 'border-amber-400/30',
            text: 'text-amber-300',
            dot: 'bg-amber-400',
            label: 'Moderate',
          }
        : {
            bg: 'bg-red-500/15',
            border: 'border-red-400/30',
            text: 'text-red-300',
            dot: 'bg-red-400',
            label: 'Needs Support',
          };

  // Generate initials
  const initials = profile.memberName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate a consistent color from name
  const hue = profile.memberName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className="group/card relative animate-fade-in-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Glow effect on hover */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-[#78e0dc]/30 to-[#ff8d4c]/30 rounded-2xl opacity-0 group-hover/card:opacity-100 blur-sm transition-opacity duration-500"></div>

      <div className="relative bg-gradient-to-br from-white/[0.12] to-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/15 p-6 hover:border-white/25 transition-all duration-500">
        {/* Shimmer on hover */}
        <div className="absolute inset-0 -translate-x-full group-hover/card:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-2xl overflow-hidden"></div>

        {/* Header */}
        <div className="relative flex items-center gap-3 mb-5">
          {/* Avatar */}
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black shadow-lg"
            style={{
              background: `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${hue + 40}, 70%, 40%))`,
              color: 'white',
            }}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{profile.memberName}</h3>
            {profile.workStyle && (
              <p className="text-xs text-white/40 italic truncate">{profile.workStyle}</p>
            )}
          </div>

          {/* On-time badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${badgeConfig.bg} ${badgeConfig.border} ${badgeConfig.text} border backdrop-blur-sm`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badgeConfig.dot}`}></span>
            {onTimePercent}% on-time
          </div>
        </div>

        {/* Stats Row */}
        <div className="relative grid grid-cols-3 gap-3 mb-5">
          <StatBadge label="Total Tasks" value={profile.totalTasks} />
          <StatBadge label="Avg Days" value={profile.avgCompletionDays} />
          <StatBadge label="Priority" value={profile.preferredPriority} capitalize />
        </div>

        {/* AI Analysis */}
        <div className="relative space-y-3">
          {profile.strengths && (
            <InfoRow icon="💪" label="Strengths" value={profile.strengths} />
          )}
          {profile.suggestion && (
            <InfoRow icon="💡" label="Suggestion" value={profile.suggestion} />
          )}
          {profile.summary && (
            <div className="mt-3 p-3.5 bg-[#78e0dc]/8 rounded-xl text-sm text-[#78e0dc]/80 border border-[#78e0dc]/15">
              <div className="flex items-start gap-2">
                <span className="text-base mt-0.5">🤖</span>
                <div>
                  <span className="font-semibold text-[#78e0dc]/90">AI Summary</span>
                  <p className="mt-1 text-white/60 text-xs leading-relaxed">{profile.summary}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, value, capitalize }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5 hover:border-white/10 transition-colors duration-300">
      <p className={`text-lg font-bold text-[#78e0dc] ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </p>
      <p className="text-[10px] text-white/35 mt-1 uppercase tracking-wider font-medium">{label}</p>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="mt-0.5">{icon}</span>
      <div>
        <span className="font-semibold text-white/70">{label}: </span>
        <span className="text-white/50">{value}</span>
      </div>
    </div>
  );
}
