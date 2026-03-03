import { useEffect, useMemo, useState } from "react";
import { api, type Skill, type ConfirmationOut } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { Card } from "../components/ui/card";
import { Target, FolderOpen, TrendingUp, FileText, X } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Link } from "react-router";
import { Button } from "../components/ui/button";

interface DashboardSummary {
  totalSkills: number;
  portfolioItems: number;
  averageMatchScore: number;
  tailoredResumes: number;
  recentActivity: Array<{
    id: number | string;
    type: string;
    action: string;
    name: string;
    date: string;
  }>;
  topSkillCategories: Array<{ category: string; count: number }>;
}

const EMPTY_SUMMARY: DashboardSummary = {
  totalSkills: 0,
  portfolioItems: 0,
  averageMatchScore: 0,
  tailoredResumes: 0,
  recentActivity: [],
  topSkillCategories: [],
};

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
  const { activities } = useActivity();
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [hiddenRecentActivityIds, setHiddenRecentActivityIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("dashboard:hiddenRecentActivityIds");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dashboard:hiddenRecentActivityIds", JSON.stringify(hiddenRecentActivityIds));
  }, [hiddenRecentActivityIds]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1) Keep existing backend summary for non-skill metrics
        const base: any = await api.getDashboardSummary().catch(() => ({} as any));

        const normalizedBase: DashboardSummary = {
          totalSkills: safeNum(base?.totalSkills ?? base?.total_skills ?? 0),
          portfolioItems: safeNum(base?.portfolioItems ?? base?.portfolio_items ?? 0),
          averageMatchScore: safeNum(base?.averageMatchScore ?? base?.average_match_score ?? 0),
          tailoredResumes: safeNum(base?.tailoredResumes ?? base?.tailored_resumes ?? 0),
          recentActivity: Array.isArray(base?.recentActivity)
            ? base.recentActivity
            : Array.isArray(base?.recent_activity)
              ? base.recent_activity
              : [],
          topSkillCategories: Array.isArray(base?.topSkillCategories)
            ? base.topSkillCategories
            : Array.isArray(base?.top_skill_categories)
              ? base.top_skill_categories
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

        const mergedRecentActivity = [
          ...activities,
          ...normalizedBase.recentActivity,
        ]
          .filter((item) => !!item?.date)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index);

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
        name: "Portfolio Items",
        value: summary.portfolioItems,
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
    () => summary.recentActivity.filter((activity) => !hiddenRecentActivityIds.includes(String(activity.id))),
    [summary.recentActivity, hiddenRecentActivityIds]
  );

  const hideRecentActivityItem = (id: string | number) => {
    const key = String(id);
    setHiddenRecentActivityIds((current) => (current.includes(key) ? current : [...current, key]));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(30,58,138,0.18),_transparent_36%),linear-gradient(135deg,_#ffffff,_#f8fafc)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.14),_transparent_34%),linear-gradient(135deg,_#0f1b2d,_#08111f)]">
        <div className="px-6 py-7 md:px-8">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name} className="border-slate-200 p-0 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80">
            <Link to={stat.href ?? "/app"} className="block p-6">
              <div className="flex items-center gap-4">
                <div className={`rounded-2xl p-3 ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-300">{stat.name}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">{stat.value}</p>
                </div>
              </div>
            </Link>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Recent Activity</h3>
            {hiddenRecentActivityIds.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setHiddenRecentActivityIds([])}>
                Reset hidden
              </Button>
            ) : null}
          </div>

          {visibleRecentActivity.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-slate-400">No recent activity yet.</div>
          ) : (
            <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
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
                      onClick={() => hideRecentActivityItem(activity.id)}
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
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Top Skill Categories</h3>
            <Badge variant="secondary">{summary.topSkillCategories.length} total</Badge>
          </div>

          {summary.topSkillCategories.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-slate-400">No categories yet. Confirm skills to populate this chart.</div>
          ) : (
            <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">
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
                      <div className="h-2.5 rounded-full bg-[linear-gradient(90deg,_#1E3A8A,_#0F766E)] transition-all" style={{ width: `${pct}%` }} />
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
