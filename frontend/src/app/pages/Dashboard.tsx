import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, type Skill, type ConfirmationOut, type RewardAchievement, type RewardsSummary } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { Card } from "../components/ui/card";
import { Award, CheckCircle2, FileText, FolderOpen, LifeBuoy, Rocket, Target, TrendingUp, X } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { useHeaderTheme } from "../lib/headerTheme";
import { GET_STARTED_STEPS } from "../lib/getStarted";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAccountPreferences } from "../context/AccountPreferencesContext";

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

const REWARD_ACTIONS: Record<string, { href: string; label: string }> = {
  evidence_saved: { href: "/app/evidence", label: "Add evidence" },
  profile_skills_confirmed: { href: "/app/skills", label: "Confirm skills" },
  skill_categories_covered: { href: "/app/skills", label: "Broaden categories" },
  resume_snapshots_uploaded: { href: "/app/evidence?add=1&type=resume", label: "Add resume evidence" },
  job_matches_run: { href: "/app/jobs", label: "Run match" },
  tailored_resumes_generated: { href: "/app/jobs", label: "Generate resume" },
};

function rewardProgressLabel(achievement: RewardAchievement): string {
  const labels: Record<string, string> = {
    evidence_saved: "evidence items",
    profile_skills_confirmed: "confirmed skills",
    skill_categories_covered: "skill categories",
    resume_snapshots_uploaded: "resume templates",
    job_matches_run: "job matches",
    tailored_resumes_generated: "tailored resumes",
  };
  const unit = labels[achievement.counter_key] ?? "steps";
  return `${achievement.current_value}/${achievement.target_value} ${unit}`;
}

const TAILORED_RESUME_FETCH_LIMIT = 1000;

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

function loadHiddenTailoredResumeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("tailoredResumes:hiddenIds");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((value) => String(value || "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
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

function RecentActivityRow({
  activity,
  onHide,
}: {
  activity: DashboardSummary["recentActivity"][number];
  onHide: (eventKey: string) => void;
}) {
  const eventKey = String(activity.eventKey ?? `${activity.id}:${activity.date}`);

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 last:border-slate-100 dark:border-slate-800 dark:bg-slate-800/60">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-start gap-2">
            <Badge variant="outline" className="shrink-0 capitalize bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {activity.type}
            </Badge>
            <p className="min-w-0 flex-1 break-words text-sm font-medium leading-5 text-gray-900 dark:text-slate-100">
              {activity.name}
            </p>
          </div>
          <p className="break-words text-xs capitalize text-gray-500 dark:text-slate-400">{activity.action}</p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <span className="pt-0.5 text-xs text-gray-500 dark:text-slate-400">
            {activity.date ? new Date(activity.date).toLocaleDateString() : ""}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            onClick={() => onHide(eventKey)}
            aria-label={`Hide activity ${activity.name}`}
            title="Hide activity"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
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
  const { user, refreshUser } = useAuth();
  const { activities, clearActivities } = useActivity();
  const { activeHeaderTheme } = useHeaderTheme();
  const { preferences } = useAccountPreferences();
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingGuide, setUpdatingGuide] = useState(false);
  const [guideStartRecorded, setGuideStartRecorded] = useState(false);
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
  const completedGuideSteps = useMemo(
    () => new Set((user?.onboarding?.completed_steps ?? []).map((value) => String(value || "").trim()).filter(Boolean)),
    [user?.onboarding?.completed_steps]
  );
  const nextGuideStep = useMemo(
    () => GET_STARTED_STEPS.find((step) => !completedGuideSteps.has(step.key)) ?? null,
    [completedGuideSteps]
  );
  const guideProgressPct = GET_STARTED_STEPS.length
    ? Math.round((completedGuideSteps.size / GET_STARTED_STEPS.length) * 100)
    : 0;

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
        const [skillsLib, profileConf, tailoredResumeRows, rewardSummary] = await Promise.all([
          loadAllSkills(),
          api.getProfileConfirmation().catch(() => null as ConfirmationOut | null),
          api.listTailoredResumes(TAILORED_RESUME_FETCH_LIMIT).catch(() => []),
          api.getRewardsSummary().catch(() => null),
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
        const hiddenTailoredResumeIds = new Set(loadHiddenTailoredResumeIds());
        const visibleTailoredResumeCount = Array.isArray(tailoredResumeRows)
          ? tailoredResumeRows.filter((item) => !hiddenTailoredResumeIds.has(String(item?.id ?? ""))).length
          : normalizedBase.tailoredResumes;

        setSummary({
          ...normalizedBase,
          // ✅ authoritative, user-specific
          totalSkills: userSpecificTotalSkills,
          tailoredResumes: visibleTailoredResumeCount,
          recentActivity: mergedRecentActivity,
          topSkillCategories,
        });
        setRewards(rewardSummary ?? null);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setSummary(EMPTY_SUMMARY);
        setRewards(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  useEffect(() => {
    setGuideStartRecorded(false);
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const markStarted = async () => {
      if (!user?.is_new_user || user?.onboarding?.started_at || updatingGuide || guideStartRecorded) return;
      try {
        await api.updateMyOnboarding({
          started_at: new Date().toISOString(),
          last_step: nextGuideStep?.key ?? GET_STARTED_STEPS[0]?.key ?? null,
        });
        setGuideStartRecorded(true);
        if (!cancelled) {
          await refreshUser();
        }
      } catch {
        // Guide progress is additive. If this fails, the UI can still render.
      }
    };
    void markStarted();
    return () => {
      cancelled = true;
    };
  }, [guideStartRecorded, nextGuideStep?.key, refreshUser, updatingGuide, user?.is_new_user, user?.onboarding?.started_at]);

  const updateGuideState = async (payload: Parameters<typeof api.updateMyOnboarding>[0]) => {
    setUpdatingGuide(true);
    try {
      await api.updateMyOnboarding(payload);
      await refreshUser();
    } finally {
      setUpdatingGuide(false);
    }
  };

  const markGuideStepComplete = async (stepKey: string) => {
    const nextCompletedSteps = Array.from(new Set([...completedGuideSteps, stepKey]));
    const payload: Parameters<typeof api.updateMyOnboarding>[0] = {
      completed_steps: nextCompletedSteps,
      last_step: stepKey,
    };
    if (nextCompletedSteps.length >= GET_STARTED_STEPS.length) {
      payload.completed_at = new Date().toISOString();
    }
    try {
      await updateGuideState(payload);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update your get started progress");
    }
  };

  const dismissGuide = async () => {
    try {
      await updateGuideState({ dismissed_at: new Date().toISOString() });
    } catch (error: any) {
      toast.error(error?.message || "Failed to hide the get started guide");
    }
  };

  const rememberGuideStep = (stepKey: string) => {
    void api
      .updateMyOnboarding({ last_step: stepKey })
      .then(() => refreshUser())
      .catch(() => {
        // Non-blocking navigation helper.
      });
  };

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
  const hasRewardsData = Boolean(
    rewards &&
      ((rewards.badges?.length ?? 0) > 0 ||
        rewards.achievements.length > 0 ||
        (rewards.badgeCount ?? 0) > 0 ||
        (rewards.totalCount ?? 0) > 0)
  );

  const combinedRecentActivity = useMemo(
    () => mergeRecentActivity([activities, summary.recentActivity]),
    [activities, summary.recentActivity]
  );

  const visibleRecentActivity = useMemo(
    () =>
      combinedRecentActivity.filter(
        (activity) =>
          !clearedRecentActivityIds.includes(String(activity.id)) &&
          !hiddenRecentActivityKeys.includes(String(activity.eventKey ?? `${activity.id}:${activity.date}`)) &&
          !clearedRecentActivityKeys.includes(String(activity.eventKey ?? `${activity.id}:${activity.date}`))
      ),
    [combinedRecentActivity, hiddenRecentActivityKeys, clearedRecentActivityKeys, clearedRecentActivityIds]
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
    setClearedRecentActivityKeys(combinedRecentActivity.map((activity) => String(activity.eventKey ?? `${activity.id}:${activity.date}`)));
    setClearedRecentActivityIds(combinedRecentActivity.map((activity) => String(activity.id)));
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
      {preferences.showWelcomeHero ? (
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
      ) : null}

      {user?.is_new_user ? (
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <Rocket className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Get Started Guide</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                This checklist walks new users through the main SkillBridge flow so the profile, evidence, matching, and analytics views all have real data behind them.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                {completedGuideSteps.size}/{GET_STARTED_STEPS.length} complete
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => void dismissGuide()} disabled={updatingGuide}>
                Hide guide
              </Button>
            </div>
          </div>

          <div className="mt-4 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700">
            <div className={`h-2.5 rounded-full ${activeHeaderTheme.barClass}`} style={{ width: `${Math.max(8, guideProgressPct)}%` }} />
          </div>

          {nextGuideStep ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Recommended next step</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{nextGuideStep.title}</div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{nextGuideStep.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" className={activeHeaderTheme.buttonClass}>
                    <Link
                      to={nextGuideStep.href}
                      onClick={() => {
                        rememberGuideStep(nextGuideStep.key);
                      }}
                    >
                      {nextGuideStep.cta}
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void markGuideStepComplete(nextGuideStep.key)} disabled={updatingGuide}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Mark complete
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {GET_STARTED_STEPS.map((step) => {
              const complete = completedGuideSteps.has(step.key);
              return (
                <div
                  key={step.key}
                  className={`rounded-2xl border p-4 ${
                    complete
                      ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                      : "border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-xl p-2 ${complete ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                        <step.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{step.title}</div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{step.description}</p>
                      </div>
                    </div>
                    <Badge
                      className={complete ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300" : "dark:border-slate-700 dark:text-slate-200"}
                      variant="outline"
                    >
                      {complete ? "Done" : "Open"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={step.href}
                        onClick={() => {
                          rememberGuideStep(step.key);
                        }}
                      >
                        {step.cta}
                      </Link>
                    </Button>
                    {!complete ? (
                      <Button size="sm" variant="ghost" onClick={() => void markGuideStepComplete(step.key)} disabled={updatingGuide}>
                        Mark complete
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <LifeBuoy className="h-4 w-4" />
            Need help during setup?
            <Link className={`font-medium ${activeHeaderTheme.accentTextClass}`} to="/app/account/help">
              Open the help page
            </Link>
          </div>
        </Card>
      ) : null}

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

      <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Award className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Achievements</h3>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Milestones grow as you save evidence, confirm skills across more categories, run job matches, and generate tailored resumes.
            </p>
          </div>
          <Badge variant="outline" className="w-fit dark:border-slate-700 dark:text-slate-200">
            {hasRewardsData
              ? `${Math.round(rewards?.completionPct ?? 0)}% complete`
              : "Sync unavailable"}
          </Badge>
        </div>

        <div className={`mt-5 grid gap-4 ${preferences.showNextAchievementCard ? "xl:grid-cols-[1.1fr_0.9fr]" : ""}`}>
          {preferences.showNextAchievementCard ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/60">
              {hasRewardsData && rewards?.nextAchievement ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Next Unlock</div>
                      <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{rewards.nextAchievement.title}</div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{rewards.nextAchievement.description}</p>
                      <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">{rewardProgressLabel(rewards.nextAchievement)}</p>
                    </div>
                    {REWARD_ACTIONS[rewards.nextAchievement.counter_key] ? (
                      <Button asChild size="sm" className={activeHeaderTheme.buttonClass}>
                        <Link to={REWARD_ACTIONS[rewards.nextAchievement.counter_key].href}>
                          {REWARD_ACTIONS[rewards.nextAchievement.counter_key].label}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-4 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className={`h-2.5 rounded-full ${activeHeaderTheme.barClass}`}
                      style={{ width: `${Math.max(6, Math.min(100, rewards.nextAchievement.progress_pct))}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{rewards.nextAchievement.reward}</p>
                </>
              ) : !hasRewardsData ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Award className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
                    <span className="text-lg font-semibold">Achievement progress is unavailable right now</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Reward data did not load, so milestone counts are hidden until the next successful sync.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Rocket className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
                    <span className="text-lg font-semibold">All current milestones unlocked</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    You have cleared the current progression track. New milestones can be added on top of this reward system without changing the existing history.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Recent Unlocks</div>
            {!hasRewardsData ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Recent unlocks will appear here once reward sync returns.</p>
            ) : rewards.recentUnlocks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No milestones unlocked yet. Your first reward appears as soon as you save evidence or confirm a skill.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {rewards.recentUnlocks.map((achievement) => (
                  <div key={achievement.key} className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{achievement.title}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{achievement.reward}</div>
                      </div>
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                        Unlocked
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </Card>

      <div className={`grid grid-cols-1 gap-6 ${preferences.showRecentActivity ? "lg:grid-cols-2" : ""}`}>
        {preferences.showRecentActivity ? (
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
                  <RecentActivityRow
                    key={activity.id}
                    activity={activity}
                    onHide={hideRecentActivityItem}
                  />
                ))}
              </div>
            )}
          </Card>
        ) : null}

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
                const totalSkills = Math.max(summary.totalSkills || 0, 1);
                const pct = Math.min(100, Math.max(0, (category.count / totalSkills) * 100));

                return (
                  <div key={category.category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{category.category}</span>
                      <span className="text-sm text-gray-600 dark:text-slate-300">
                        {category.count}/{summary.totalSkills} skills
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-2.5 rounded-full transition-all ${activeHeaderTheme.barClass}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{pct.toFixed(0)}% of your confirmed skills</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {preferences.showPortfolioInsights ? (
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
      ) : null}

    </div>
  );
}
