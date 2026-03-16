import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { api, type CareerPathDetail } from "../services/api";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { ArrowLeft, Compass, Sparkles } from "lucide-react";
import { useHeaderTheme } from "../lib/headerTheme";

export function CareerPathDetail() {
  const { activeHeaderTheme } = useHeaderTheme();
  const { roleId } = useParams();
  const [detail, setDetail] = useState<CareerPathDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!roleId) return;
      setLoading(true);
      try {
        const result = await api.getCareerPathDetail(roleId);
        if (active) setDetail(result);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [roleId]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">Loading career path...</div>;
  }

  if (!detail) {
    return <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">Career path not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="flex flex-col justify-between gap-4 px-6 py-7 md:px-8 lg:flex-row lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              <Compass className={`h-3.5 w-3.5 ${activeHeaderTheme.accentTextClass}`} />
              Career Path Detail
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{detail.role_name}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{detail.reasoning}</p>
          </div>
          <Button asChild variant="outline" className="border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70">
            <Link to="/app/analytics/skills">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Analytics
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-slate-500 dark:text-slate-400">Trajectory Score</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{Math.round(detail.score)}%</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{detail.confidence_label} confidence</p>
        </Card>
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-slate-500 dark:text-slate-400">Personal Vector Alignment</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{Math.round(detail.personal_vector_alignment_score)}%</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Cluster: {detail.cluster_category || "General"}</p>
        </Card>
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-slate-500 dark:text-slate-400">Progress Bonus</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">+{detail.progress_bonus_score.toFixed(1)}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Lift from completed or in-progress learning steps</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Role Weights and Skills</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.top_role_skills.map((skill) => (
              <Badge key={`top:${skill}`} variant="secondary" className="dark:bg-slate-900 dark:text-slate-200">{skill}</Badge>
            ))}
          </div>
          <h4 className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Recommended Skills To Add</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.recommended_skills_to_add.map((skill) => (
              <Badge key={`add:${skill}`} variant="outline" className="dark:border-slate-700 dark:text-slate-200">{skill}</Badge>
            ))}
          </div>
        </Card>

        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Graph Neighbors</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.graph_neighbor_skills.map((skill) => (
              <Badge key={`neighbor:${skill}`} variant="outline" className="dark:border-slate-700 dark:text-slate-200">{skill}</Badge>
            ))}
          </div>
          <h4 className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Project Ideas</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {detail.recommended_project_ideas.map((idea) => (
              <li key={idea} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/50">{idea}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-2">
          <Sparkles className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recommended Resources</h3>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {detail.recommended_resources.map((resource) => (
            <a
              key={`${resource.title}:${resource.url}`}
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-900/70"
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100">{resource.title}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{resource.provider}</p>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
