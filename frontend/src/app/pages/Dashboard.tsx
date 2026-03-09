import { useEffect, useMemo, useState } from "react";
import { api, type Skill, type ConfirmationOut } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { Card } from "../components/ui/card";
import { Target, FolderOpen, TrendingUp, FileText, X } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { useHeaderTheme } from "../lib/headerTheme";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DashboardSummary {
  totalSkills: number;
  evidenceCount: number;
  averageMatchScore: number;
  tailoredResumes: number;
  recentActivity: Array<{
    id: number | string;
    eventKey?: string;
    type: string;
    action: string;
    name: string;
    date: string;
  }>;
  topSkillCategories: Array<{ category: string; count: number }>;
  portfolioToJobAnalytics: {
    job_skill_coverage_pct: number;
    matched_skill_rate_pct: number;
    evidence_backed_match_pct: number;
    portfolio_backed_match_pct: number;
    portfolio_skill_count: number;
    job_skill_count: number;
  };
  portfolioTypeDistribution: Array<{ type: string; count: number }>;
  recentMatchTrend: Array<{ label: string; score: number; created_at?: string }>;
}

const EMPTY_SUMMARY: DashboardSummary = {
  totalSkills: 0,
  evidenceCount: 0,
  averageMatchScore: 0,
  tailoredResumes: 0,
  recentActivity: [],
  topSkillCategories: [],
  portfolioToJobAnalytics: {
    job_skill_coverage_pct: 0,
    matched_skill_rate_pct: 0,
    evidence_backed_match_pct: 0,
    portfolio_backed_match_pct: 0,
    portfolio_skill_count: 0,
    job_skill_count: 0,
  },
  portfolioTypeDistribution: [],
  recentMatchTrend: [],
};

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function activityTimestamp(value: any): number {
  if (!value) return 0;
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : 0;
}

function normalizedActivityDate(value: any): string {
  const now = Date.now();
  const stamp = activityTimestamp(value);
  if (!stamp) return new Date(0).toISOString();
  // Protect ordering from bad future-skewed timestamps coming from persisted records.
  if (stamp > now + 5 * 60 * 1000) {
    return new Date(now).toISOString();
  }
  return new Date(stamp).toISOString();
}

function normalizeRecentActivityItem(item: any) {
  const rawDate = item?.date ?? item?.created_at ?? item?.updated_at ?? "";
  const date = normalizedActivityDate(rawDate);
  const id = String(item?.id ?? `${item?.type ?? "activity"}:${item?.action ?? "updated"}:${item?.name ?? "item"}:${date}`);
  const rawDateKey = String(rawDate || date);
  return {
    id,
    eventKey: `${id}:${rawDateKey}`,
    type: String(item?.type ?? "activity"),
    action: String(item?.action ?? "updated"),
    name: String(item?.name ?? "Untitled"),
    date,
  };
}

function mergeRecentActivity(sources: Array<Array<any>>): DashboardSummary["recentActivity"] {
  const byId = new Map<string, DashboardSummary["recentActivity"][number]>();
  for (const source of sources) {
    for (const rawItem of source) {
      const item = normalizeRecentActivityItem(rawItem);
      const existing = byId.get(item.id);
      if (!existing || activityTimestamp(item.date) > activityTimestamp(existing.date)) {
        byId.set(item.id, item);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => activityTimestamp(b.date) - activityTimestamp(a.date));
}

async function loadAllSkills(): Promise<Skill[]> {
  const pageSize = 200;
  const allSkills: Skill[] = [];
  let skip = 0;

  while (true) {
    const batch = await api.listSkills({ limit: pageSize, skip }).catch(() => [] as Skill[]);
    if (!Array.isArray(batch) || batch.length === 0) break;
    allSkills.push(...batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }

  return allSkills;
}

export function Dashboard() {
  const { user } = useAuth();
  const { activities, clearActivities } = useActivity();
  const { activeHeaderTheme } = useHeaderTheme();
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [hiddenRecentActivityKeys, setHiddenRecentActivityKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("dashboard:hiddenRecentActivityKeys");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [clearedRecentActivityKeys, setClearedRecentActivityKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("dashboard:clearedRecentActivityKeys");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [clearedRecentActivityIds, setClearedRecentActivityIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("dashboard:clearedRecentActivityIds");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard:hiddenRecentActivityKeys", JSON.stringify(hiddenRecentActivityKeys));
  }, [hiddenRecentActivityKeys]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard:clearedRecentActivityKeys", JSON.stringify(clearedRecentActivityKeys));
  }, [clearedRecentActivityKeys]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard:clearedRecentActivityIds", JSON.stringify(clearedRecentActivityIds));
  }, [clearedRecentActivityIds]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1) Keep existing backend summary for non-skill metrics
        const base: any = await api.getDashboardSummary().catch(() => ({} as any));

        const normalizedBase: DashboardSummary = {
          totalSkills: safeNum(base?.totalSkills ?? base?.total_skills ?? 0),
          evidenceCount: safeNum(base?.evidenceCount ?? base?.evidence_count ?? base?.totals?.evidence ?? 0),
          averageMatchScore: safeNum(base?.averageMatchScore ?? base?.average_match_score ?? 0),
          tailoredResumes: safeNum(base?.tailoredResumes ?? base?.tailored_resumes ?? 0),
          recentActivity: Array.isArray(base?.recentActivity)
            ? base.recentActivity.map(normalizeRecentActivityItem)
            : Array.isArray(base?.recent_activity)
              ? base.recent_activity.map(normalizeRecentActivityItem)
              : [],
          topSkillCategories: Array.isArray(base?.topSkillCategories)
            ? base.topSkillCategories
            : Array.isArray(base?.top_skill_categories)
              ? base.top_skill_categories
              : [],
          portfolioToJobAnalytics: {
            job_skill_coverage_pct: safeNum(base?.portfolioToJobAnalytics?.job_skill_coverage_pct ?? base?.portfolio_to_job_analytics?.job_skill_coverage_pct ?? 0),
            matched_skill_rate_pct: safeNum(base?.portfolioToJobAnalytics?.matched_skill_rate_pct ?? base?.portfolio_to_job_analytics?.matched_skill_rate_pct ?? 0),
            evidence_backed_match_pct: safeNum(base?.portfolioToJobAnalytics?.evidence_backed_match_pct ?? base?.portfolio_to_job_analytics?.evidence_backed_match_pct ?? 0),
            portfolio_backed_match_pct: safeNum(base?.portfolioToJobAnalytics?.portfolio_backed_match_pct ?? base?.portfolio_to_job_analytics?.portfolio_backed_match_pct ?? 0),
            portfolio_skill_count: safeNum(base?.portfolioToJobAnalytics?.portfolio_skill_count ?? base?.portfolio_to_job_analytics?.portfolio_skill_count ?? 0),
            job_skill_count: safeNum(base?.portfolioToJobAnalytics?.job_skill_count ?? base?.portfolio_to_job_analytics?.job_skill_count ?? 0),
          },
          portfolioTypeDistribution: Array.isArray(base?.portfolioTypeDistribution)
            ? base.portfolioTypeDistribution
            : Array.isArray(base?.portfolio_type_distribution)
              ? base.portfolio_type_distribution
              : [],
          recentMatchTrend: Array.isArray(base?.recentMatchTrend)
            ? base.recentMatchTrend
            : Array.isArray(base?.recent_match_trend)
              ? base.recent_match_trend
              : [],
        };

        // 2) User-specific overrides for skills:
        //    - profile confirmation = resume_snapshot_id null
        //    - total skills = confirmed length
        //    - top categories computed from confirmed skill ids -> global skills list mapping
        const [skillsLib, profileConf] = await Promise.all([
          loadAllSkills(),
          api.getProfileConfirmation().catch(() => null as ConfirmationOut | null),
        ]);
        const confirmed = Array.isArray(profileConf?.confirmed) ? profileConf!.confirmed : [];
        const confirmedIds = new Set(confirmed.map((c) => (c?.skill_id ?? "").trim()).filter(Boolean));
        const skillsById = new Map(
          (Array.isArray(skillsLib) ? skillsLib : []).map((skill) => [String(skill?.id ?? "").trim(), skill])
        );
        const confirmedVisibleSkillIds = new Set<string>();
        for (const id of confirmedIds) {
          if (skillsById.has(id)) confirmedVisibleSkillIds.add(id);
        }

        const activeSkills = Array.from(confirmedVisibleSkillIds)
          .map((id) => skillsById.get(id))
          .filter((skill): skill is Skill => Boolean(skill));

        const categoryCounts = new Map<string, number>();
        for (const s of activeSkills) {
          const cat = (s?.category ?? "").trim() || "Uncategorized";
          categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
        }

        const topSkillCategories = Array.from(categoryCounts.entries())
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

        const userSpecificTotalSkills = confirmedVisibleSkillIds.size;

        const mergedRecentActivity = mergeRecentActivity([
          activities,
          normalizedBase.recentActivity,
        ]);

        setSummary({
          ...normalizedBase,
          // ✅ authoritative, user-specific
          totalSkills: userSpecificTotalSkills,
          recentActivity: mergedRecentActivity,
          topSkillCategories,
        });
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setSummary(EMPTY_SUMMARY);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activities, user?.id]);

  const stats = useMemo(
    () => [
      {
        name: "Total Skills",
        value: summary.totalSkills,
        icon: Target,
        color: "text-[#1E3A8A]",
        bgColor: "bg-blue-50",
      },
      {
        name: "Evidence",
        value: summary.evidenceCount,
        icon: FolderOpen,
        color: "text-[#0D9488]",
        bgColor: "bg-teal-50",
      },
      {
        name: "Average Match Score",
        value: `${summary.averageMatchScore}%`,
        icon: TrendingUp,
        color: "text-[#1E3A8A]",
        bgColor: "bg-blue-50",
      },
      {
        name: "Tailored Resumes",
        value: summary.tailoredResumes,
        icon: FileText,
        color: "text-[#0D9488]",
        bgColor: "bg-teal-50",
        href: "/app/resumes",
      },
    ],
    [summary]
  );

  const visibleRecentActivity = useMemo(
    () =>
      summary.recentActivity.filter(
        (activity) =>
          !clearedRecentActivityIds.includes(String(activity.id)) &&
          !hiddenRecentActivityKeys.includes(String(activity.eventKey ?? `${activity.id}:${activity.date}`)) &&
          !clearedRecentActivityKeys.includes(String(activity.eventKey ?? `${activity.id}:${activity.date}`))
      ),
    [summary.recentActivity, hiddenRecentActivityKeys, clearedRecentActivityKeys, clearedRecentActivityIds]
  );

  const portfolioVisualMetrics = useMemo(
    () => [
      {
        label: "Matched Skills",
        value: `${Math.round(summary.portfolioToJobAnalytics.matched_skill_rate_pct)}%`,
        detail: "Coverage across recent analyzed jobs",
      },
      {
        label: "Evidence-Backed",
        value: `${Math.round(summary.portfolioToJobAnalytics.evidence_backed_match_pct)}%`,
        detail: "Matched skills already supported by evidence",
      },
    ],
    [summary.portfolioToJobAnalytics]
  );

  const hideRecentActivityItem = (id: string | number) => {
    setHiddenRecentActivityKeys((current) => (current.includes(String(id)) ? current : [...current, String(id)]));
  };

  const handleClearRecentActivity = () => {
    setClearedRecentActivityKeys(summary.recentActivity.map((activity) => String(activity.eventKey ?? `${activity.id}:${activity.date}`)));
    setClearedRecentActivityIds(summary.recentActivity.map((activity) => String(activity.id)));
    setHiddenRecentActivityKeys([]);
    clearActivities();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-6 py-6 md:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              Career Overview
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Welcome back, {user?.username || (user as any)?.name || "there"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Track your confirmed skills, evidence momentum, and job-match readiness from one place.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="border-slate-200 p-0 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80">
            <Link to={stat.href ?? "/app"} className="block p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-2xl p-2.5 ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-300">{stat.name}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-slate-100">{stat.value}</p>
                </div>
              </div>
            </Link>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Recent Activity</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleClearRecentActivity}>
                Clear recent
              </Button>
              {hiddenRecentActivityKeys.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setHiddenRecentActivityKeys([])}>
                  Reset hidden
                </Button>
              ) : null}
            </div>
          </div>

          {visibleRecentActivity.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-slate-400">No recent activity yet.</div>
          ) : (
            <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
              {visibleRecentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 last:border-slate-100 dark:border-slate-800 dark:bg-slate-800/60"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {activity.type}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{activity.name}</p>
                      <p className="text-xs text-gray-500 capitalize dark:text-slate-400">{activity.action}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      {activity.date ? new Date(activity.date).toLocaleDateString() : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                      onClick={() => hideRecentActivityItem(activity.eventKey ?? `${activity.id}:${activity.date}`)}
                      aria-label={`Hide activity ${activity.name}`}
                      title="Hide activity"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Skill Categories */}
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Top Skill Categories</h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{summary.topSkillCategories.length} total</Badge>
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/analytics/skills">View analytics</Link>
              </Button>
            </div>
          </div>

          {summary.topSkillCategories.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-slate-400">No categories yet. Confirm skills to populate this chart.</div>
          ) : (
            <div className="max-h-[22rem] space-y-4 overflow-y-auto pr-1">
              {summary.topSkillCategories.map((category) => {
                const denom = summary.topSkillCategories.reduce((acc, c) => acc + (c.count || 0), 0) || 1;
                const pct = Math.min(100, Math.max(0, (category.count / denom) * 100));

                return (
                  <div key={category.category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{category.category}</span>
                      <span className="text-sm text-gray-600 dark:text-slate-300">{category.count} skills</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-2.5 rounded-full transition-all ${activeHeaderTheme.barClass}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Evidence to Job Match</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                How strongly your saved work history supports the skills showing up in recent job analyses.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/analytics/skills">Open analytics</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {portfolioVisualMetrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{metric.label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{metric.value}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{metric.detail}</p>
              </div>
            ))}
          </div>
          {summary.recentMatchTrend.length > 0 ? (
            <div className="mt-5 h-52 rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/30">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.recentMatchTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                    formatter={(value: number) => [`${Math.round(Number(value) || 0)}%`, "Match score"]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="score" radius={[10, 10, 4, 4]} fill="var(--dashboard-accent, #1E3A8A)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Analyze a few jobs to unlock a recent match trend chart here.
            </div>
          )}
        </Card>

        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Evidence Signal Mix</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              The types of evidence currently contributing to your profile depth.
            </p>
          </div>
          {summary.portfolioTypeDistribution.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Add evidence to start visualizing how your work history is distributed.
            </div>
          ) : (
            <div className="max-h-[22rem] space-y-4 overflow-y-auto pr-1">
              {summary.portfolioTypeDistribution.map((entry) => {
                const maxCount = Math.max(...summary.portfolioTypeDistribution.map((item) => item.count), 1);
                const width = (entry.count / maxCount) * 100;
                return (
                  <div key={entry.type} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize text-slate-900 dark:text-slate-100">{entry.type}</span>
                      <span className="text-slate-600 dark:text-slate-300">{entry.count}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-3 rounded-full ${activeHeaderTheme.barClass}`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}
