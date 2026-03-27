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
    <div className="space-y-6">
      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-6 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                <BarChart3 className="h-3.5 w-3.5" />
                Skill Analytics
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">A compact view of proof, gaps, and direction.</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Scan what is confirmed, what is backed by evidence, and where the next useful signal lives.
              </p>
            </div>
            <Button asChild variant="outline" className="border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70">
              <Link to="/app/skills">
                Review skills
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
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

      <div id="overview" className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr] scroll-mt-24">
        <AnalyticsSection
          title="Vector Drift"
          description="Aggregate profile score across recent updates."
          className="h-full"
        >
          {analytics.vectorHistory.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No vector history yet. Analyze a job to generate the first point.</div>
          ) : (
            <div className="h-56 rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/30">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.vectorHistory}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.18} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [`${Math.round(Number(value) || 0)}%`, "Vector score"]} />
                  <Line type="monotone" dataKey="score" stroke="#1E3A8A" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </AnalyticsSection>

        <AnalyticsSection title="Evidence Mix" description="What is supporting the profile today.">
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
        <AnalyticsSection title="Confirmed Categories" description="Distribution of your confirmed skills by category.">
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

        <AnalyticsSection title="Proficiency Spread" description="How confirmed skills are distributed across levels.">
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
        <AnalyticsSection title="Skill Clusters" description="The strongest clusters currently shaping direction." compact>
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

        <AnalyticsSection title="Career Paths" description="Role fits based on skill coverage, proof, and semantic alignment." compact>
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
        description="A staged plan from proof-gaps to higher-confidence role readiness."
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
                      ? "Already confirmed. Focus on stronger proof and project depth."
                      : "Not yet confirmed. Treat this as a targeted gap with a clear next action."}
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
