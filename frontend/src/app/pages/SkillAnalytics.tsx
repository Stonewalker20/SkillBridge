import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ArrowRight, BarChart3, BookOpen, FolderOpen, Layers3, RefreshCw, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import {
  api,
  type CareerPathDetail,
  type ConfirmationOut,
  type Evidence,
  type LearningPathProgress,
  type LearningPathSkillDetail,
  type Skill,
  type SkillTrajectoryOut,
} from "../services/api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../components/ui/chart";
import { useHeaderTheme } from "../lib/headerTheme";
import { AnalyticsMetric, AnalyticsSection, BadgeCloud } from "./SkillAnalyticsParts";

type AnalyticsState = {
  loading: boolean;
  skills: Skill[];
  evidence: Evidence[];
  confirmation: ConfirmationOut | null;
  trajectory: SkillTrajectoryOut | null;
  learningProgress: LearningPathProgress[];
};

const CHART_COLORS = ["#1E3A8A", "#0F766E", "#F59E0B", "#2563EB", "#14B8A6", "#F97316", "#7C3AED", "#DC2626"];

const categoryChartConfig = {
  count: {
    label: "Skills",
    theme: {
      light: "#1E3A8A",
      dark: "#60A5FA",
    },
  },
} satisfies ChartConfig;

const proficiencyChartConfig = {
  count: {
    label: "Skills",
    theme: {
      light: "#0F766E",
      dark: "#2DD4BF",
    },
  },
} satisfies ChartConfig;

const evidenceTypeChartConfig = {
  value: {
    label: "Evidence",
    theme: {
      light: "#F59E0B",
      dark: "#FBBF24",
    },
  },
} satisfies ChartConfig;

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

function asSkillCategories(skill: Skill): string[] {
  const categories = Array.isArray(skill.categories) && skill.categories.length ? skill.categories : [skill.category ?? ""];
  return categories.map((value) => String(value || "").trim()).filter(Boolean);
}

function normalizeEvidenceTypeLabel(value: string): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Other";
  if (normalized === "project") return "Project";
  if (normalized === "resume") return "Resume";
  if (normalized === "certification") return "Certification";
  if (normalized === "course") return "Coursework";
  if (normalized === "job") return "Work History";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function SkillAnalytics() {
  const { activeHeaderTheme } = useHeaderTheme();
  const navigate = useNavigate();
  const [state, setState] = useState<AnalyticsState>({
    loading: true,
    skills: [],
    evidence: [],
    confirmation: null,
    trajectory: null,
    learningProgress: [],
  });
  const [selectedLearningSkill, setSelectedLearningSkill] = useState<string | null>(null);
  const [selectedLearningSkillDetail, setSelectedLearningSkillDetail] = useState<LearningPathSkillDetail | null>(null);
  const [selectedCareerPathId, setSelectedCareerPathId] = useState<string | null>(null);
  const [selectedCareerPathDetail, setSelectedCareerPathDetail] = useState<CareerPathDetail | null>(null);
  const [updatingProgressSkill, setUpdatingProgressSkill] = useState<string | null>(null);
  const [progressImpact, setProgressImpact] = useState<{ roleName: string; delta: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = useCallback(async (options?: { background?: boolean }) => {
    const background = Boolean(options?.background);
    if (background) setRefreshing(true);
    else setState((current) => ({ ...current, loading: true }));
    try {
      const [skills, evidence, confirmation, trajectory, learningProgress] = await Promise.all([
        loadAllSkills(),
        api.listEvidence({ origin: "user" }).catch(() => [] as Evidence[]),
        api.getProfileConfirmation().catch(() => null as ConfirmationOut | null),
        api.getSkillTrajectory().catch(() => null as SkillTrajectoryOut | null),
        api.listLearningPathProgress().catch(() => [] as LearningPathProgress[]),
      ]);
      setState({ loading: false, skills, evidence, confirmation, trajectory, learningProgress });
    } catch (error) {
      console.error("Failed to load skill analytics:", error);
      setState((current) =>
        background
          ? { ...current, loading: false }
          : { loading: false, skills: [], evidence: [], confirmation: null, trajectory: null, learningProgress: [] }
      );
    } finally {
      if (background) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void loadAnalytics({ background: true });
      }
    };
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [loadAnalytics]);

  useEffect(() => {
    const firstSkill = state.trajectory?.learning_path?.[0]?.target_skills?.[0] ?? null;
    if (firstSkill && !selectedLearningSkill) {
      setSelectedLearningSkill(firstSkill);
    }
  }, [state.trajectory, selectedLearningSkill]);

  useEffect(() => {
    const firstPath = state.trajectory?.career_paths?.[0]?.role_id ?? null;
    if (firstPath && !selectedCareerPathId) {
      setSelectedCareerPathId(firstPath);
    }
  }, [state.trajectory, selectedCareerPathId]);

  useEffect(() => {
    let active = true;
    const loadSkillDetail = async () => {
      if (!selectedLearningSkill) {
        setSelectedLearningSkillDetail(null);
        return;
      }
      const detail = await api.getLearningPathSkillDetail(selectedLearningSkill).catch(() => null);
      if (active) setSelectedLearningSkillDetail(detail);
    };
    loadSkillDetail();
    return () => {
      active = false;
    };
  }, [selectedLearningSkill, state.learningProgress, state.trajectory]);

  useEffect(() => {
    let active = true;
    const loadCareerPathDetail = async () => {
      if (!selectedCareerPathId) {
        setSelectedCareerPathDetail(null);
        return;
      }
      const detail = await api.getCareerPathDetail(selectedCareerPathId).catch(() => null);
      if (active) setSelectedCareerPathDetail(detail);
    };
    loadCareerPathDetail();
    return () => {
      active = false;
    };
  }, [selectedCareerPathId, state.trajectory]);

  const analytics = useMemo(() => {
    const skillsById = new Map(state.skills.map((skill) => [String(skill.id || "").trim(), skill]));
    const confirmedEntries = Array.isArray(state.confirmation?.confirmed) ? state.confirmation.confirmed : [];
    const confirmedIds = Array.from(new Set(confirmedEntries.map((entry) => String(entry?.skill_id ?? "").trim()).filter(Boolean)));
    const confirmedSkills = confirmedIds.map((id) => skillsById.get(id)).filter((skill): skill is Skill => Boolean(skill));

    const evidenceSkillCounts = new Map<string, number>();
    const evidenceTypeCounts = new Map<string, number>();
    for (const item of state.evidence) {
      const evidenceType = normalizeEvidenceTypeLabel(String(item.type || "other"));
      evidenceTypeCounts.set(evidenceType, (evidenceTypeCounts.get(evidenceType) ?? 0) + 1);
      const uniqueSkillIds = new Set((item.skill_ids ?? []).map((value) => String(value || "").trim()).filter(Boolean));
      for (const skillId of uniqueSkillIds) {
        evidenceSkillCounts.set(skillId, (evidenceSkillCounts.get(skillId) ?? 0) + 1);
      }
    }

    const categoryCounts = new Map<string, number>();
    for (const skill of confirmedSkills) {
      const categories = asSkillCategories(skill);
      if (!categories.length) {
        categoryCounts.set("Uncategorized", (categoryCounts.get("Uncategorized") ?? 0) + 1);
        continue;
      }
      for (const category of categories) {
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      }
    }

    const proficiencyBuckets = new Map<number, { count: number; skills: string[] }>();
    let evidenceBackedConfirmed = 0;
    for (const entry of confirmedEntries) {
      const proficiency = Number(entry?.proficiency ?? 0) || 0;
      const skillName = skillsById.get(String(entry?.skill_id ?? "").trim())?.name;
      const bucket = proficiencyBuckets.get(proficiency) ?? { count: 0, skills: [] };
      bucket.count += 1;
      if (skillName) bucket.skills.push(skillName);
      proficiencyBuckets.set(proficiency, bucket);
      if ((Number(entry?.evidence_count ?? 0) || 0) > 0) {
        evidenceBackedConfirmed += 1;
      }
    }

    const unsupportedConfirmed = Math.max(0, confirmedEntries.length - evidenceBackedConfirmed);

    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

    const topEvidenceSkills = Array.from(evidenceSkillCounts.entries())
      .map(([skillId, count]) => ({
        skillId,
        name: skillsById.get(skillId)?.name || "",
        count,
      }))
      .filter((entry) => entry.name)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8);

    const evidenceTypes = Array.from(evidenceTypeCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

    const proficiencyData = Array.from(proficiencyBuckets.entries())
      .map(([level, value]) => ({
        level,
        label: `Level ${level}`,
        count: value.count,
        skills: Array.from(new Set(value.skills)).sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.level - b.level);

    return {
      confirmedCount: confirmedEntries.length,
      evidenceBackedConfirmed,
      unsupportedConfirmed,
      totalEvidence: state.evidence.length,
      topCategories,
      topEvidenceSkills,
      evidenceTypes,
      proficiencyData,
      trajectoryClusters: state.trajectory?.clusters ?? [],
      careerPaths: state.trajectory?.career_paths ?? [],
      learningPath: state.trajectory?.learning_path ?? [],
      learningProgress: state.learningProgress,
    };
  }, [state]);

  const highlights = useMemo(() => {
    const topEvidenceSkill = analytics.topEvidenceSkills[0];
    const topEvidenceType = analytics.evidenceTypes[0];
    const topCareerPath = analytics.careerPaths[0];
    const topLearningStep = analytics.learningPath[0];
    const proofPct = analytics.confirmedCount > 0 ? Math.round((analytics.evidenceBackedConfirmed / analytics.confirmedCount) * 100) : 0;
    const topEvidenceMax = analytics.topEvidenceSkills[0]?.count ?? 0;
    const topEvidencePct = topEvidenceMax > 0 && topEvidenceSkill ? Math.round((topEvidenceSkill.count / topEvidenceMax) * 100) : 0;
    const evidenceTypeMax = analytics.evidenceTypes[0]?.value ?? 0;
    const topEvidenceTypePct = evidenceTypeMax > 0 && topEvidenceType ? Math.round((topEvidenceType.value / evidenceTypeMax) * 100) : 0;
    const topLearningPct = topLearningStep ? Math.min(100, Math.max(24, Math.round((topLearningStep.target_skills.length / 5) * 100))) : 0;

    return [
      {
        label: "Proof-backed",
        value: `${analytics.evidenceBackedConfirmed}/${analytics.confirmedCount}`,
        note: analytics.confirmedCount ? `${proofPct}% of confirmed skills have evidence.` : "Add a few confirmed skills.",
        icon: ShieldCheck,
        toneClass: "bg-[#0F766E]",
        barPct: proofPct,
      },
      {
        label: "Top evidence",
        value: topEvidenceSkill?.name || "None yet",
        note: topEvidenceSkill ? `${topEvidenceSkill.count} linked evidence item${topEvidenceSkill.count === 1 ? "" : "s"}.` : "Your strongest evidence signal will show here.",
        icon: BookOpen,
        toneClass: "bg-[#1E3A8A]",
        barPct: topEvidencePct,
      },
      {
        label: "Best role fit",
        value: topCareerPath?.role_name || "Waiting",
        note: topCareerPath ? `${Math.round(topCareerPath.score)}% match with your current data.` : "Analyze jobs to unlock role matches.",
        icon: TrendingUp,
        toneClass: "bg-[#7C3AED]",
        barPct: Math.round(topCareerPath?.score ?? 0),
      },
      {
        label: "Next move",
        value: topLearningStep?.title || "No path yet",
        note: topLearningStep ? topLearningStep.evidence_action : "Confirm more skills to build a path.",
        icon: Sparkles,
        toneClass: "bg-[#F59E0B]",
        barPct: topLearningPct,
      },
      {
        label: "Main evidence type",
        value: topEvidenceType?.name || "No evidence",
        note: topEvidenceType ? `${topEvidenceType.value} item${topEvidenceType.value === 1 ? "" : "s"}.` : "Upload or paste evidence to start.",
        icon: Target,
        toneClass: "bg-slate-700",
        barPct: topEvidenceTypePct,
      },
    ];
  }, [analytics]);

  const handleProgressUpdate = async (skillName: string, status: LearningPathProgress["status"]) => {
    setUpdatingProgressSkill(skillName);
    try {
      const updated = await api.patchLearningPathProgress({ skill_name: skillName, status });
      const previousCareerPaths = state.trajectory?.career_paths ?? [];
      const [trajectory, pathDetail, skillDetail] = await Promise.all([
        api.getSkillTrajectory().catch(() => state.trajectory),
        selectedCareerPathId ? api.getCareerPathDetail(selectedCareerPathId).catch(() => selectedCareerPathDetail) : Promise.resolve(selectedCareerPathDetail),
        api.getLearningPathSkillDetail(skillName).catch(() => selectedLearningSkillDetail),
      ]);
      const previousSelected = selectedCareerPathId ? previousCareerPaths.find((item) => item.role_id === selectedCareerPathId) : null;
      const nextSelected = selectedCareerPathId ? trajectory?.career_paths?.find((item) => item.role_id === selectedCareerPathId) ?? null : null;
      if (previousSelected && nextSelected) {
        setProgressImpact({
          roleName: nextSelected.role_name,
          delta: Number((nextSelected.score - previousSelected.score).toFixed(2)),
        });
      } else {
        setProgressImpact(null);
      }
      setSelectedCareerPathDetail(pathDetail ?? null);
      setSelectedLearningSkillDetail(skillDetail ?? null);
      setState((current) => {
        const others = current.learningProgress.filter((item) => item.skill_name !== updated.skill_name);
        return {
          ...current,
          trajectory: trajectory ?? current.trajectory,
          learningProgress: [...others, updated].sort((a, b) => a.skill_name.localeCompare(b.skill_name)),
        };
      });
    } finally {
      setUpdatingProgressSkill(null);
    }
  };

  if (state.loading) {
    return <div className="flex h-full items-center justify-center text-gray-500 dark:text-slate-400">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className={`relative overflow-hidden rounded-[2rem] border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.55),_transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.04),rgba(14,116,144,0.06),rgba(245,158,11,0.06))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.08),_transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.12),rgba(14,116,144,0.18),rgba(245,158,11,0.12))]" />
        <div className="relative grid gap-6 px-6 py-7 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
              <BarChart3 className="h-3.5 w-3.5" />
              Skill Analytics
            </div>
            <h1 className="mt-4 max-w-xl text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
              Your skills, shown like a live signal board.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
              See what is proven, what still needs proof, and which direction the data is pushing you toward next.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-white/90 text-slate-700 shadow-sm dark:bg-slate-950/70 dark:text-slate-200">
                {analytics.confirmedCount} confirmed
              </Badge>
              <Badge variant="secondary" className="bg-white/90 text-slate-700 shadow-sm dark:bg-slate-950/70 dark:text-slate-200">
                {analytics.evidenceBackedConfirmed} with proof
              </Badge>
              <Badge variant="secondary" className="bg-white/90 text-slate-700 shadow-sm dark:bg-slate-950/70 dark:text-slate-200">
                {analytics.unsupportedConfirmed} need support
              </Badge>
            </div>
            <div className="mt-6">
              <Button asChild variant="outline" className="border-slate-200 bg-white/80 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/60">
                <Link to="/app/skills">
                  Review skills
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {highlights.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.label}:${index}`}
                  className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{item.label}</div>
                      <div className="mt-2 break-words text-lg font-semibold text-slate-900 dark:text-slate-100">{item.value}</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{item.note}</p>
                    </div>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg ${item.toneClass}`}>
                      <Icon className="h-4.5 w-4.5 text-white" />
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${item.toneClass}`}
                      style={{ width: `${Math.max(0, Math.min(100, item.barPct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsMetric
          icon={Target}
          label="Confirmed Skills"
          value={analytics.confirmedCount}
          caption="Skills currently in the profile"
          toneClass="bg-[#1E3A8A]"
        />
        <AnalyticsMetric
          icon={FolderOpen}
          label="Evidence-Backed"
          value={analytics.evidenceBackedConfirmed}
          caption="Confirmed skills with proof"
          toneClass="bg-[#0F766E]"
        />
        <AnalyticsMetric
          icon={Layers3}
          label="Without Evidence"
          value={analytics.unsupportedConfirmed}
          caption="Confirmed skills still missing proof"
          toneClass="bg-[#F59E0B]"
        />
        <AnalyticsMetric
          icon={BarChart3}
          label="Evidence Items"
          value={analytics.totalEvidence}
          caption="User-uploaded evidence records"
          toneClass="bg-slate-700"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/70"
          onClick={() => void loadAnalytics({ background: true })}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing" : "Refresh"}
        </Button>
        {[
          ["#overview", "Overview"],
          ["#support", "Support"],
          ["#trajectory", "Trajectory"],
          ["#learning", "Learning Path"],
        ].map(([href, label]) => (
          <Button key={href} asChild variant="outline" size="sm" className="h-8 rounded-full border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/70">
            <a href={href}>{label}</a>
          </Button>
        ))}
      </div>

      <div id="overview" className="grid grid-cols-1 gap-6 scroll-mt-24">
        <AnalyticsSection title="Evidence Mix" description="What is feeding the engine right now.">
          {analytics.evidenceTypes.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No evidence added yet.</div>
          ) : (
            <>
              <ChartContainer config={evidenceTypeChartConfig} className="h-64 w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Pie data={analytics.evidenceTypes} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={4}>
                    {analytics.evidenceTypes.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="mt-4 space-y-3">
                {analytics.topEvidenceSkills.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">Add evidence to surface the most documented skills.</div>
                ) : (
                  analytics.topEvidenceSkills.map((skill, index) => {
                    const maxCount = analytics.topEvidenceSkills[0]?.count || 1;
                    const width = Math.max(8, (skill.count / maxCount) * 100);
                    return (
                      <div key={skill.skillId}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="min-w-7 justify-center dark:border-slate-700 dark:text-slate-200">
                              {index + 1}
                            </Badge>
                            <span className="font-medium text-slate-900 dark:text-slate-100">{skill.name}</span>
                          </div>
                          <span className="text-slate-600 dark:text-slate-300">{skill.count} items</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-2.5 rounded-full bg-[linear-gradient(90deg,_#1E3A8A,_#0F766E)]" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </AnalyticsSection>
      </div>

      <div id="support" className="grid grid-cols-1 gap-6 xl:grid-cols-2 scroll-mt-24">
        <AnalyticsSection title="Confirmed Categories" description="Where your strongest signals cluster.">
          {analytics.topCategories.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No confirmed categories yet.</div>
          ) : (
            <ChartContainer config={categoryChartConfig} className="h-[300px] w-full">
              <BarChart data={analytics.topCategories.slice(0, 10)} margin={{ left: 12, right: 12, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="category" tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={56} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="var(--color-count)" />
              </BarChart>
            </ChartContainer>
          )}
        </AnalyticsSection>

        <AnalyticsSection title="Proficiency Spread" description="How strength is stacked across levels.">
          {analytics.proficiencyData.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No confirmed skill proficiency data yet.</div>
          ) : (
            <>
              <ChartContainer config={proficiencyChartConfig} className="h-[260px] w-full">
                <BarChart data={analytics.proficiencyData} margin={{ left: 8, right: 8, top: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="var(--color-count)" />
                </BarChart>
              </ChartContainer>
              <div className="mt-4 max-h-[14rem] space-y-3 overflow-y-auto pr-1">
                {analytics.proficiencyData.map((bucket) => (
                  <div key={bucket.level} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{bucket.label}</span>
                      <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                        {bucket.count} skill{bucket.count === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <BadgeCloud
                      items={bucket.skills}
                      emptyLabel="No visible skills at this level."
                      className="mt-2"
                      badgeClassName="dark:bg-slate-900 dark:text-slate-200"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </AnalyticsSection>
      </div>

      <div id="trajectory" className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr] scroll-mt-24">
        <AnalyticsSection title="Skill Clusters" description="Patterns that keep repeating." compact>
          {analytics.trajectoryClusters.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Confirm more skills to generate cluster-level signals.</div>
          ) : (
            <div className="max-h-[21rem] space-y-2.5 overflow-y-auto pr-1">
              {analytics.trajectoryClusters.map((cluster) => (
                <div key={cluster.category} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cluster.category}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {cluster.skill_count} skills • {cluster.evidence_backed_count} backed • avg {cluster.average_proficiency.toFixed(1)}
                      </p>
                    </div>
                    <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                      {cluster.skill_names.length}
                    </Badge>
                  </div>
                  <BadgeCloud
                    items={cluster.skill_names}
                    emptyLabel="No skills in this cluster."
                    className="mt-2.5"
                    limit={6}
                    badgeClassName="dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
              ))}
            </div>
          )}
        </AnalyticsSection>

        <AnalyticsSection title="Career Paths" description="Roles the data likes most." compact>
          {analytics.careerPaths.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Add roles and analyze jobs to unlock career path predictions.</div>
          ) : (
            <div className="max-h-[21rem] space-y-2.5 overflow-y-auto pr-1">
              {analytics.careerPaths.map((path) => (
                <button
                  type="button"
                  key={path.role_id}
                  onClick={() => {
                    setSelectedCareerPathId(path.role_id);
                    navigate(`/app/analytics/career-paths/${path.role_id}`);
                  }}
                  className={`w-full rounded-2xl border p-3.5 text-left transition ${selectedCareerPathId === path.role_id ? "border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-900/70" : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/60"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{path.role_name}</p>
                        <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                          {path.confidence_label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{path.reasoning}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{Math.round(path.score)}%</p>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{path.cluster_category || "General"}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Vector {Math.round(path.personal_vector_alignment_score ?? 0)}%</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Matched ({path.matched_skills.length})
                      </p>
                      <BadgeCloud
                        items={path.matched_skills}
                        emptyLabel="No matched skills yet."
                        className="mt-1.5"
                        limit={4}
                        badgeClassName="dark:bg-slate-900 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Missing ({path.missing_skills.length})
                      </p>
                      <BadgeCloud
                        items={path.missing_skills}
                        emptyLabel="No critical gaps detected."
                        className="mt-1.5"
                        limit={4}
                        variant="outline"
                        badgeClassName="dark:border-slate-700 dark:text-slate-200"
                      />
                    </div>
                  </div>
                  {path.next_steps.length ? <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{path.next_steps[0]}</p> : null}
                </button>
              ))}
            </div>
          )}
        </AnalyticsSection>
      </div>

      {selectedCareerPathDetail ? (
        <AnalyticsSection
          title={`${selectedCareerPathDetail.role_name} Deep Dive`}
          description={selectedCareerPathDetail.reasoning}
          actions={<Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">Vector {Math.round(selectedCareerPathDetail.personal_vector_alignment_score)}%</Badge>}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Top Skills</p>
              <BadgeCloud items={selectedCareerPathDetail.top_role_skills} emptyLabel="None" className="mt-2" badgeClassName="dark:bg-slate-900 dark:text-slate-200" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Graph Neighbors</p>
              <BadgeCloud items={selectedCareerPathDetail.graph_neighbor_skills} emptyLabel="None" className="mt-2" variant="outline" badgeClassName="dark:border-slate-700 dark:text-slate-200" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Project Ideas</p>
              <div className="mt-2 space-y-2">
                {selectedCareerPathDetail.recommended_project_ideas.map((idea) => (
                  <div key={idea} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                    {idea}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnalyticsSection>
      ) : null}

      <AnalyticsSection
        id="learning"
        title="Learning Path"
        description="A simple next-step plan from gaps to stronger proof."
        compact
        className="scroll-mt-24"
      >
        {analytics.learningPath.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Confirm more skills and analyze target roles to generate a learning path.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="max-h-[28rem] space-y-2.5 overflow-y-auto pr-1">
              {analytics.learningPath.map((step) => (
                <div
                  key={`${step.phase}:${step.title}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/60"
                >
                  <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                          {step.phase}
                        </Badge>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{step.target_skills.length} targets</span>
                      </div>
                      <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{step.title}</h4>
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{step.rationale}</p>
                    </div>
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <BadgeCloud
                        items={step.target_skills}
                        emptyLabel="No target skills."
                        limit={4}
                        badgeClassName={
                          selectedLearningSkill === step.target_skills[0]
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                          : "dark:bg-slate-900 dark:text-slate-200"
                      }
                      />
                      <p className="text-xs leading-5 text-slate-700 dark:text-slate-300">{step.evidence_action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/60">
              {progressImpact ? (
                <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-900/80 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {progressImpact.roleName} trajectory {progressImpact.delta >= 0 ? "increased" : "decreased"} by {Math.abs(progressImpact.delta).toFixed(2)} points after the latest update.
                </div>
              ) : null}
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {selectedLearningSkillDetail?.skill_name || selectedLearningSkill || "Select a target skill"}
              </h4>
              {selectedLearningSkillDetail ? (
                <>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {selectedLearningSkillDetail.confirmed
                      ? "Confirmed already. Add sharper proof and more depth."
                      : "Not confirmed yet. Treat it like a focused gap with one clear next move."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                      Evidence support {selectedLearningSkillDetail.evidence_support_count}
                    </Badge>
                    <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                      {selectedLearningSkillDetail.progress_status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingProgressSkill === selectedLearningSkillDetail.skill_name}
                      onClick={() => handleProgressUpdate(selectedLearningSkillDetail.skill_name, "in_progress")}
                    >
                      In Progress
                    </Button>
                    <Button
                      size="sm"
                      disabled={updatingProgressSkill === selectedLearningSkillDetail.skill_name}
                      onClick={() => handleProgressUpdate(selectedLearningSkillDetail.skill_name, "completed")}
                      className={activeHeaderTheme.buttonClass}
                    >
                      Complete
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Related Careers</p>
                      <BadgeCloud items={selectedLearningSkillDetail.related_career_paths} emptyLabel="None" className="mt-1.5" limit={5} badgeClassName="dark:bg-slate-900 dark:text-slate-200" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Graph Neighbors</p>
                      <BadgeCloud items={selectedLearningSkillDetail.graph_neighbors} emptyLabel="None" className="mt-1.5" limit={5} variant="outline" badgeClassName="dark:border-slate-700 dark:text-slate-200" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Recommended Projects</p>
                      <div className="mt-1.5 space-y-2">
                        {selectedLearningSkillDetail.recommended_projects.map((idea) => (
                          <div key={idea} className="rounded-xl bg-white/70 px-3 py-2 text-sm leading-5 text-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                            {idea}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Resources</p>
                      <div className="mt-1.5 space-y-2">
                        {selectedLearningSkillDetail.recommended_resources.map((resource) => (
                          <a
                            key={`${resource.title}:${resource.url}`}
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-xl bg-white/70 px-3 py-2 text-sm leading-5 text-slate-700 transition hover:bg-white dark:bg-slate-950/40 dark:text-slate-300 dark:hover:bg-slate-900"
                          >
                            <span className="font-medium">{resource.title}</span>
                            <span className="ml-2 text-slate-500 dark:text-slate-400">{resource.provider}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Select a target skill to inspect gaps, neighbors, and next steps.
                </p>
              )}
            </div>
          </div>
        )}
      </AnalyticsSection>
    </div>
  );
}
