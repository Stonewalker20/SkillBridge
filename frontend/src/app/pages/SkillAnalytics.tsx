import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, BarChart3, FolderOpen, Layers3, Target } from "lucide-react";
import {
  api,
  type CareerPathDetail,
  type ConfirmationOut,
  type Evidence,
  type LearningPathProgress,
  type LearningPathSkillDetail,
  type Skill,
  type SkillTrajectoryOut,
  type UserSkillVectorHistoryPoint,
} from "../services/api";
import { Card } from "../components/ui/card";
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

type AnalyticsState = {
  loading: boolean;
  skills: Skill[];
  evidence: Evidence[];
  confirmation: ConfirmationOut | null;
  trajectory: SkillTrajectoryOut | null;
  learningProgress: LearningPathProgress[];
  vectorHistory: UserSkillVectorHistoryPoint[];
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
    vectorHistory: [],
  });
  const [selectedLearningSkill, setSelectedLearningSkill] = useState<string | null>(null);
  const [selectedLearningSkillDetail, setSelectedLearningSkillDetail] = useState<LearningPathSkillDetail | null>(null);
  const [selectedCareerPathId, setSelectedCareerPathId] = useState<string | null>(null);
  const [selectedCareerPathDetail, setSelectedCareerPathDetail] = useState<CareerPathDetail | null>(null);
  const [updatingProgressSkill, setUpdatingProgressSkill] = useState<string | null>(null);
  const [progressImpact, setProgressImpact] = useState<{ roleName: string; delta: number } | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [skills, evidence, confirmation, trajectory, learningProgress, vectorHistory] = await Promise.all([
          loadAllSkills(),
          api.listEvidence({ origin: "user" }).catch(() => [] as Evidence[]),
          api.getProfileConfirmation().catch(() => null as ConfirmationOut | null),
          api.getSkillTrajectory().catch(() => null as SkillTrajectoryOut | null),
          api.listLearningPathProgress().catch(() => [] as LearningPathProgress[]),
          api.getUserSkillVectorHistory().catch(() => [] as UserSkillVectorHistoryPoint[]),
        ]);
        if (!active) return;
        setState({ loading: false, skills, evidence, confirmation, trajectory, learningProgress, vectorHistory });
      } catch (error) {
        console.error("Failed to load skill analytics:", error);
        if (!active) return;
        setState({ loading: false, skills: [], evidence: [], confirmation: null, trajectory: null, learningProgress: [], vectorHistory: [] });
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

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
  }, [selectedLearningSkill, state.learningProgress]);

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
  }, [selectedCareerPathId]);

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
      vectorHistory: state.vectorHistory,
    };
  }, [state]);

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
    <div className="space-y-8">
      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-6 py-7 md:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                <BarChart3 className="h-3.5 w-3.5" />
                Skill Analytics
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Understand how your skill profile is supported.</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Explore category coverage, evidence support, proficiency distribution, and which skills are driving your portfolio depth.
              </p>
            </div>
            <Button asChild variant="outline" className="border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70">
              <Link to="/app/skills">
                Review Skills
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Personal Skill Vector Drift</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Tracks how your aggregate user embedding evolves as you confirm skills and add proof.
          </p>
        </div>
        {analytics.vectorHistory.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">No vector history yet. Analyze jobs or open the job match page to generate one.</div>
        ) : (
          <div className="h-56 rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/30">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.vectorHistory}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [`${Math.round(Number(value) || 0)}%`, "Vector score"]} />
                <Line type="monotone" dataKey="score" stroke="#1E3A8A" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-500/10">
              <Target className="h-5 w-5 text-[#1E3A8A] dark:text-blue-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Confirmed Skills</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analytics.confirmedCount}</p>
            </div>
          </div>
        </Card>
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-teal-50 p-3 dark:bg-teal-500/10">
              <FolderOpen className="h-5 w-5 text-[#0F766E] dark:text-teal-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Evidence-Backed</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analytics.evidenceBackedConfirmed}</p>
            </div>
          </div>
        </Card>
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-500/10">
              <Layers3 className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Without Evidence</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analytics.unsupportedConfirmed}</p>
            </div>
          </div>
        </Card>
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
              <FolderOpen className="h-5 w-5 text-slate-700 dark:text-slate-200" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Evidence Items</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analytics.totalEvidence}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Confirmed Skill Categories</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Category distribution across your confirmed skill profile.</p>
          </div>
          {analytics.topCategories.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No confirmed categories yet.</div>
          ) : (
            <ChartContainer config={categoryChartConfig} className="h-[320px] w-full">
              <BarChart data={analytics.topCategories.slice(0, 10)} margin={{ left: 12, right: 12, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="category" tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={64} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="var(--color-count)" />
              </BarChart>
            </ChartContainer>
          )}
        </Card>

        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Evidence by Type</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">What kinds of artifacts are supporting your profile.</p>
          </div>
          {analytics.evidenceTypes.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No evidence added yet.</div>
          ) : (
            <ChartContainer config={evidenceTypeChartConfig} className="h-[320px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Pie data={analytics.evidenceTypes} dataKey="value" nameKey="name" innerRadius={68} outerRadius={108} paddingAngle={4}>
                  {analytics.evidenceTypes.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Most Supported Skills</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Skills that appear most often across your evidence library.</p>
          </div>
          {analytics.topEvidenceSkills.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Add evidence to see which skills are most documented.</div>
          ) : (
            <div className="space-y-4">
              {analytics.topEvidenceSkills.map((skill, index) => {
                const maxCount = analytics.topEvidenceSkills[0]?.count || 1;
                const width = Math.max(8, (skill.count / maxCount) * 100);
                return (
                  <div key={skill.skillId}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="min-w-8 justify-center dark:border-slate-700 dark:text-slate-200">
                          {index + 1}
                        </Badge>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{skill.name}</span>
                      </div>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{skill.count} evidence items</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-2.5 rounded-full bg-[linear-gradient(90deg,_#1E3A8A,_#0F766E)]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Proficiency Distribution</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">How your confirmed skills are distributed across current proficiency levels.</p>
          </div>
          {analytics.proficiencyData.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No confirmed skill proficiency data yet.</div>
          ) : (
            <ChartContainer config={proficiencyChartConfig} className="h-[280px] w-full">
              <BarChart data={analytics.proficiencyData} margin={{ left: 8, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="var(--color-count)" />
              </BarChart>
            </ChartContainer>
          )}
          {analytics.proficiencyData.length > 0 ? (
            <div className="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              {analytics.proficiencyData.map((bucket) => (
                <div key={bucket.level} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{bucket.label}</span>
                    <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                      {bucket.count} skill{bucket.count === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {bucket.skills.length ? (
                      bucket.skills.map((skill) => (
                        <Badge key={`${bucket.level}:${skill}`} variant="secondary" className="dark:bg-slate-900 dark:text-slate-200">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">No visible skills at this level.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Skill Clusters</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">The strongest clusters in your profile that are currently shaping career direction.</p>
          </div>
          {analytics.trajectoryClusters.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Confirm more skills to generate cluster-level trajectory signals.</div>
          ) : (
            <div className="space-y-4">
              {analytics.trajectoryClusters.map((cluster) => (
                <div key={cluster.category} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cluster.category}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {cluster.skill_count} skills • {cluster.evidence_backed_count} evidence-backed • avg proficiency {cluster.average_proficiency.toFixed(1)}
                      </p>
                    </div>
                    <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                      {cluster.skill_names.length}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cluster.skill_names.map((skill) => (
                      <Badge key={`${cluster.category}:${skill}`} variant="secondary" className="dark:bg-slate-900 dark:text-slate-200">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Career Path Trajectory</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Predicted role paths based on weighted skill coverage, evidence support, and semantic fit.</p>
          </div>
          {analytics.careerPaths.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Add roles and analyze jobs to unlock career path predictions.</div>
          ) : (
            <div className="space-y-4">
              {analytics.careerPaths.map((path) => (
                <button
                  type="button"
                  key={path.role_id}
                  onClick={() => {
                    setSelectedCareerPathId(path.role_id);
                    navigate(`/app/analytics/career-paths/${path.role_id}`);
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition ${selectedCareerPathId === path.role_id ? "border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-900/70" : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/60"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{path.role_name}</p>
                        <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                          {path.confidence_label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{path.reasoning}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{Math.round(path.score)}%</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{path.cluster_category || "General"} cluster</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Vector {Math.round(path.personal_vector_alignment_score ?? 0)}%</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Matched Skills</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {path.matched_skills.length ? path.matched_skills.map((skill) => (
                          <Badge key={`${path.role_id}:matched:${skill}`} variant="secondary" className="dark:bg-slate-900 dark:text-slate-200">
                            {skill}
                          </Badge>
                        )) : <span className="text-xs text-slate-500 dark:text-slate-400">No matched skills yet.</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Missing Skills</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {path.missing_skills.length ? path.missing_skills.map((skill) => (
                          <Badge key={`${path.role_id}:missing:${skill}`} variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                            {skill}
                          </Badge>
                        )) : <span className="text-xs text-slate-500 dark:text-slate-400">No critical gaps detected.</span>}
                      </div>
                    </div>
                  </div>
                  {path.next_steps.length ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Next Steps</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                        {path.next_steps.map((step) => (
                          <li key={`${path.role_id}:${step}`}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {selectedCareerPathDetail ? (
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedCareerPathDetail.role_name} Deep Dive</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedCareerPathDetail.reasoning}</p>
            </div>
            <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
              Vector {Math.round(selectedCareerPathDetail.personal_vector_alignment_score)}%
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Top Role Skills</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedCareerPathDetail.top_role_skills.map((skill) => (
                  <Badge key={`top:${skill}`} variant="secondary" className="dark:bg-slate-900 dark:text-slate-200">{skill}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Graph Neighbors</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedCareerPathDetail.graph_neighbor_skills.map((skill) => (
                  <Badge key={`neighbor:${skill}`} variant="outline" className="dark:border-slate-700 dark:text-slate-200">{skill}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Project Ideas</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {selectedCareerPathDetail.recommended_project_ideas.map((idea) => (
                  <li key={idea} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/50">{idea}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Learning Path Recommendation</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            A staged plan based on your strongest clusters, projected career paths, and the highest-impact missing skills.
          </p>
        </div>
        {analytics.learningPath.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Confirm more skills and analyze target roles to generate a learning path.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {analytics.learningPath.map((step) => (
              <div key={`${step.phase}:${step.title}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                    {step.phase}
                  </Badge>
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {step.target_skills.length} targets
                  </span>
                </div>
                <h4 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">{step.title}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.rationale}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {step.target_skills.map((skill) => (
                    <button
                      type="button"
                      key={`${step.phase}:${skill}`}
                      onClick={() => setSelectedLearningSkill(skill)}
                      className={`rounded-full px-2.5 py-1 text-sm ${selectedLearningSkill === skill ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-200 text-slate-800 dark:bg-slate-900 dark:text-slate-200"}`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Evidence Action</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{step.evidence_action}</p>
                </div>
              </div>
            ))}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-800/60">
              {progressImpact ? (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/80 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {progressImpact.roleName} trajectory {progressImpact.delta >= 0 ? "increased" : "decreased"} by {Math.abs(progressImpact.delta).toFixed(2)} points after this progress update.
                </div>
              ) : null}
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {selectedLearningSkillDetail?.skill_name || selectedLearningSkill || "Select a target skill"}
              </h4>
              {selectedLearningSkillDetail ? (
                <>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {selectedLearningSkillDetail.confirmed
                      ? "This skill is already confirmed. The remaining focus is stronger proof and project depth."
                      : "This skill is not yet confirmed in your profile and should be treated as a targeted learning gap."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                      Evidence support {selectedLearningSkillDetail.evidence_support_count}
                    </Badge>
                    <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                      {selectedLearningSkillDetail.progress_status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
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
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Related Career Paths</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedLearningSkillDetail.related_career_paths.map((path) => (
                        <Badge key={path} variant="secondary" className="dark:bg-slate-900 dark:text-slate-200">{path}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Graph Neighbors</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedLearningSkillDetail.graph_neighbors.map((skill) => (
                        <Badge key={skill} variant="outline" className="dark:border-slate-700 dark:text-slate-200">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Recommended Projects</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      {selectedLearningSkillDetail.recommended_projects.map((idea) => (
                        <li key={idea} className="rounded-xl bg-white/70 px-3 py-2 dark:bg-slate-950/40">{idea}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Recommended Resources</p>
                    <div className="mt-2 space-y-2">
                      {selectedLearningSkillDetail.recommended_resources.map((resource) => (
                        <a
                          key={`${resource.title}:${resource.url}`}
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl bg-white/70 px-3 py-2 text-sm text-slate-700 transition hover:bg-white dark:bg-slate-950/40 dark:text-slate-300 dark:hover:bg-slate-900"
                        >
                          <span className="font-medium">{resource.title}</span>
                          <span className="ml-2 text-slate-500 dark:text-slate-400">{resource.provider}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Choose a target skill to inspect evidence gaps, graph neighbors, and project ideas.
                </p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
