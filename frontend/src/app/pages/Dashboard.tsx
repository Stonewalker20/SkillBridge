import { useEffect, useMemo, useState } from "react";
import { api, type Skill, type ConfirmationOut } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { Card } from "../components/ui/card";
import { Target, FolderOpen, TrendingUp, FileText } from "lucide-react";
import { Badge } from "../components/ui/badge";

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
          .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
          .slice(0, 8);

        const userSpecificTotalSkills = confirmedVisibleSkillIds.size;

        const mergedRecentActivity = [
          ...activities,
          ...normalizedBase.recentActivity,
        ]
          .filter((item) => !!item?.date)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index)
          .slice(0, 6);

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
      },
    ],
    [summary]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(30,58,138,0.18),_transparent_36%),linear-gradient(135deg,_#ffffff,_#f8fafc)]">
        <div className="px-6 py-7 md:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Career Overview
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {user?.username || (user as any)?.name || "there"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Track your confirmed skills, evidence momentum, and job-match readiness from one place.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name} className="border-slate-200 p-6 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className={`rounded-2xl p-3 ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="border-slate-200 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Badge variant="secondary">{summary.recentActivity.length} latest</Badge>
          </div>

          {summary.recentActivity.length === 0 ? (
            <div className="text-sm text-gray-500">No recent activity yet.</div>
          ) : (
            <div className="space-y-3">
              {summary.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 last:border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize bg-white">
                      {activity.type}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{activity.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{activity.action}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {activity.date ? new Date(activity.date).toLocaleDateString() : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Skill Categories */}
        <Card className="border-slate-200 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Top Skill Categories</h3>
            <Badge variant="secondary">{summary.topSkillCategories.length} shown</Badge>
          </div>

          {summary.topSkillCategories.length === 0 ? (
            <div className="text-sm text-gray-500">No categories yet. Confirm skills to populate this chart.</div>
          ) : (
            <div className="space-y-4">
              {summary.topSkillCategories.map((category) => {
                const denom = summary.topSkillCategories.reduce((acc, c) => acc + (c.count || 0), 0) || 1;
                const pct = Math.min(100, Math.max(0, (category.count / denom) * 100));

                return (
                  <div key={category.category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{category.category}</span>
                      <span className="text-sm text-gray-600">{category.count} skills</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100">
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
