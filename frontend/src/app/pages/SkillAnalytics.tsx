import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ArrowRight, BarChart3, FolderOpen, Layers3, Target } from "lucide-react";
import { api, type ConfirmationOut, type Evidence, type Skill } from "../services/api";
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

type AnalyticsState = {
  loading: boolean;
  skills: Skill[];
  evidence: Evidence[];
  confirmation: ConfirmationOut | null;
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

export function SkillAnalytics() {
  const [state, setState] = useState<AnalyticsState>({
    loading: true,
    skills: [],
    evidence: [],
    confirmation: null,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [skills, evidence, confirmation] = await Promise.all([
          loadAllSkills(),
          api.listEvidence().catch(() => [] as Evidence[]),
          api.getProfileConfirmation().catch(() => null as ConfirmationOut | null),
        ]);
        if (!active) return;
        setState({ loading: false, skills, evidence, confirmation });
      } catch (error) {
        console.error("Failed to load skill analytics:", error);
        if (!active) return;
        setState({ loading: false, skills: [], evidence: [], confirmation: null });
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const analytics = useMemo(() => {
    const skillsById = new Map(state.skills.map((skill) => [String(skill.id || "").trim(), skill]));
    const confirmedEntries = Array.isArray(state.confirmation?.confirmed) ? state.confirmation.confirmed : [];
    const confirmedIds = Array.from(new Set(confirmedEntries.map((entry) => String(entry?.skill_id ?? "").trim()).filter(Boolean)));
    const confirmedSkills = confirmedIds.map((id) => skillsById.get(id)).filter((skill): skill is Skill => Boolean(skill));

    const evidenceSkillCounts = new Map<string, number>();
    const evidenceTypeCounts = new Map<string, number>();
    for (const item of state.evidence) {
      const evidenceType = String(item.type || "other").trim() || "other";
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

    const proficiencyCounts = new Map<string, number>();
    let evidenceBackedConfirmed = 0;
    for (const entry of confirmedEntries) {
      const proficiency = Number(entry?.proficiency ?? 0) || 0;
      proficiencyCounts.set(`Level ${proficiency}`, (proficiencyCounts.get(`Level ${proficiency}`) ?? 0) + 1);
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
        name: skillsById.get(skillId)?.name || "Unknown skill",
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8);

    const evidenceTypes = Array.from(evidenceTypeCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

    const proficiencyData = Array.from(proficiencyCounts.entries())
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => a.level.localeCompare(b.level));

    return {
      confirmedCount: confirmedEntries.length,
      evidenceBackedConfirmed,
      unsupportedConfirmed,
      totalEvidence: state.evidence.length,
      topCategories,
      topEvidenceSkills,
      evidenceTypes,
      proficiencyData,
    };
  }, [state]);

  if (state.loading) {
    return <div className="flex h-full items-center justify-center text-gray-500 dark:text-slate-400">Loading analytics...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(30,58,138,0.18),_transparent_36%),linear-gradient(135deg,_#ffffff,_#f8fafc)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.14),_transparent_34%),linear-gradient(135deg,_#0f1b2d,_#08111f)]">
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
                <XAxis dataKey="level" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="var(--color-count)" />
              </BarChart>
            </ChartContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
