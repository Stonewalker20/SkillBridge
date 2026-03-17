import { useEffect, useMemo, useState } from "react";
import { Boxes, Clock3, DatabaseZap, FlaskConical, Gauge, Play, RefreshCw, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useHeaderTheme } from "../lib/headerTheme";
import {
  api,
  type AdminMlflowDataset,
  type AdminMlflowJob,
  type AdminMlflowLocalOptions,
  type AdminMlflowOverview,
  type AdminMlflowRun,
  type AdminMlflowRunDetail,
} from "../services/api";
import { AdminSectionNav } from "../components/AdminSectionNav";

function formatTimestamp(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Unknown";
}

function formatMetricValue(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "No metric";
  return value >= 10 ? value.toFixed(1) : value.toFixed(3);
}

function metricName(metricKey?: string | null) {
  switch (metricKey) {
    case "ranking.map":
      return "Match ranking";
    case "ranking.ndcg_at_3":
      return "Top 3 ranking";
    case "ranking.ndcg_at_5":
      return "Top 5 ranking";
    case "extraction.f1":
      return "Skill finding";
    case "extraction.recall":
      return "Skills found";
    case "extraction.precision":
      return "Skill accuracy";
    case "rewrite.keyword_recall":
      return "Keyword coverage";
    case "accuracy":
      return "Accuracy";
    default:
      return metricKey || "Main score";
  }
}

function paramName(paramKey: string) {
  switch (paramKey) {
    case "inference_mode":
      return "Mode";
    case "embedding_model":
      return "Embedding model";
    case "zero_shot_model":
      return "Zero-shot model";
    case "rewrite_model":
      return "Rewrite model";
    case "top_k":
      return "Top results checked";
    case "max_candidates":
      return "Max matches checked";
    default:
      return paramKey.replace(/_/g, " ");
  }
}

function jobKindLabel(kind: string) {
  switch (kind) {
    case "mlflow_experiment":
      return "Test run";
    case "mlflow_dataset_export":
      return "Test data export";
    default:
      return kind.replace(/_/g, " ");
  }
}

function statusLabel(status?: string | null) {
  if (!status) return "Unknown";
  switch (status.toLowerCase()) {
    case "finished":
      return "Finished";
    case "running":
      return "Running";
    case "failed":
      return "Failed";
    case "scheduled":
      return "Queued";
    case "queued":
      return "Queued";
    case "succeeded":
      return "Finished";
    default:
      return status;
  }
}

function formatMetricLabel(run?: Pick<AdminMlflowRun, "primary_metric_key" | "primary_metric_value"> | null) {
  if (!run?.primary_metric_key || run.primary_metric_value == null) return "No metric logged";
  return `${metricName(run.primary_metric_key)}: ${formatMetricValue(run.primary_metric_value)}`;
}

function formatDuration(seconds?: number | null) {
  if (seconds == null || Number.isNaN(seconds)) return "Unknown";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function explainMetric(metricKey?: string | null) {
  switch (metricKey) {
    case "ranking.map":
      return "Shows how well the system puts the right matches near the top. Higher is better.";
    case "ranking.ndcg_at_3":
      return "Shows how good the first 3 results are. Higher is better.";
    case "ranking.ndcg_at_5":
      return "Shows how good the first 5 results are. Higher is better.";
    case "extraction.f1":
      return "Shows how well the system finds the right skills without adding too many wrong ones.";
    case "extraction.recall":
      return "Shows how many of the right skills were found. Higher is better.";
    case "extraction.precision":
      return "Shows how often the found skills were correct. Higher is better.";
    case "rewrite.keyword_recall":
      return "Shows how well the rewrite kept the important job keywords. Higher is better.";
    case "accuracy":
      return "Shows the percent of correct results. Higher is better.";
    default:
      return "This is the main score for the run. Higher is usually better.";
  }
}

function explainJobStatus(status: string) {
  switch (status) {
    case "queued":
      return "Waiting to start.";
    case "running":
      return "Running now.";
    case "succeeded":
      return "Finished successfully.";
    case "failed":
      return "Stopped because of an error. Check the log.";
    default:
      return "Current job state.";
  }
}

function computeEdgeReadiness(run: AdminMlflowRunDetail | null) {
  if (!run) {
      return {
        label: "No run selected",
        tone: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200",
      summary: "Select a run to see whether this local setup looks light enough to keep testing for edge devices.",
    };
  }
  const params = run.params ?? {};
  const inferenceMode = String(params.inference_mode ?? "").toLowerCase();
  if (inferenceMode === "local-fallback") {
      return {
      label: "Fallback only",
      tone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
      summary: "This run used the fallback path, not the transformer path, so it does not tell us much about edge-device model use.",
    };
  }

  const embeddingModel = String(params.embedding_model ?? "");
  const zeroShotModel = String(params.zero_shot_model ?? "");
  const rewriteModel = String(params.rewrite_model ?? "");
  const extractionLatency = Number(run.metrics["extraction.avg_latency_ms"] ?? 0) || 0;
  const rankingLatency = Number(run.metrics["ranking.avg_latency_ms"] ?? 0) || 0;
  const rewriteLatency = Number(run.metrics["rewrite.avg_latency_ms"] ?? 0) || 0;

  let heaviness = 0;
  if (/all-MiniLM-L6/i.test(embeddingModel)) heaviness += 1;
  else if (/all-MiniLM-L12/i.test(embeddingModel)) heaviness += 2;
  else heaviness += 2;

  if (/bart-large/i.test(zeroShotModel)) heaviness += 4;
  else if (/deberta/i.test(zeroShotModel)) heaviness += 2;
  else heaviness += 3;

  if (/flan-t5-small/i.test(rewriteModel)) heaviness += 1;
  else if (/flan-t5-base/i.test(rewriteModel)) heaviness += 3;
  else heaviness += 2;

  const latencyPenalty =
    (extractionLatency > 1200 ? 2 : extractionLatency > 600 ? 1 : 0) +
    (rankingLatency > 1200 ? 2 : rankingLatency > 600 ? 1 : 0) +
    (rewriteLatency > 1600 ? 2 : rewriteLatency > 900 ? 1 : 0);

  const total = heaviness + latencyPenalty;
  if (total <= 5) {
      return {
        label: "Best current edge candidate",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
      summary: "This looks like the best local setup to keep pushing toward edge devices.",
    };
  }
  if (total <= 8) {
    return {
      label: "Borderline for edge",
      tone: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200",
      summary: "This might work later, but it still looks a bit heavy right now.",
    };
  }
  return {
    label: "Too heavy right now",
    tone: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200",
    summary: "This setup looks too heavy for edge use in its current form.",
  };
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseIntCsv(value: string) {
  return splitCsv(value)
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function metricPriority(metricKey: string) {
  switch (metricKey) {
    case "ranking.map":
      return 1;
    case "extraction.f1":
      return 2;
    case "rewrite.keyword_recall":
      return 3;
    case "ranking.ndcg_at_3":
      return 4;
    case "ranking.ndcg_at_5":
      return 5;
    case "extraction.recall":
      return 6;
    case "extraction.precision":
      return 7;
    case "accuracy":
      return 8;
    default:
      return 50;
  }
}

function isCoreParam(paramKey: string) {
  return ["inference_mode", "embedding_model", "zero_shot_model", "rewrite_model", "top_k", "max_candidates"].includes(paramKey);
}

function jobTone(status: string) {
  switch (status) {
    case "succeeded":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300";
    case "running":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300";
  }
}

export function AdminMlflow() {
  const { activeHeaderTheme } = useHeaderTheme();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AdminMlflowOverview | null>(null);
  const [datasets, setDatasets] = useState<AdminMlflowDataset[]>([]);
  const [jobs, setJobs] = useState<AdminMlflowJob[]>([]);
  const [localOptions, setLocalOptions] = useState<AdminMlflowLocalOptions | null>(null);
  const [selectedExperimentId, setSelectedExperimentId] = useState("");
  const [runs, setRuns] = useState<AdminMlflowRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runDetail, setRunDetail] = useState<AdminMlflowRunDetail | null>(null);
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [launchingExperiment, setLaunchingExperiment] = useState(false);
  const [launchingExport, setLaunchingExport] = useState(false);
  const [runForm, setRunForm] = useState({
    experimentName: "skillbridge-admin-sweep",
    runName: "",
    datasetId: "bundled-samples",
    inferenceModes: "local-transformer",
    embeddingModels: "sentence-transformers/all-MiniLM-L6-v2",
    zeroShotModels: "MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33",
    rewriteModels: "google/flan-t5-small",
    maxCandidates: "25",
    topK: "1, 3, 5",
    tags: "launched_by=admin_ui",
    skipExtraction: false,
    skipRanking: false,
    skipRewrite: false,
  });
  const [exportForm, setExportForm] = useState({
    maxUsers: "150",
    maxPerUser: "6",
    negativeCount: "3",
    mongoDb: "",
  });

  const refreshCore = async () => {
    const [overviewData, datasetData, jobData, localOptionsData] = await Promise.all([
      api.getAdminMlflowOverview(),
      api.listAdminMlflowDatasets(),
      api.listAdminMlflowJobs(20),
      api.getAdminMlflowLocalOptions(),
    ]);
    setOverview(overviewData);
    setDatasets(datasetData);
    setJobs(jobData);
    setLocalOptions(localOptionsData);
    setSelectedExperimentId((current) => {
      if (overviewData.experiments.some((experiment) => experiment.id === current)) return current;
      return overviewData.experiments[0]?.id ?? "";
    });
    setRunForm((current) => {
      const nextDatasetId = datasetData.some((dataset) => dataset.id === current.datasetId) ? current.datasetId : datasetData[0]?.id ?? "bundled-samples";
      return {
        ...current,
        datasetId: nextDatasetId,
        inferenceModes: current.inferenceModes || localOptionsData.default_inference_mode,
        embeddingModels: current.embeddingModels || localOptionsData.default_embedding_model,
        zeroShotModels: current.zeroShotModels || localOptionsData.default_zero_shot_model,
        rewriteModels: current.rewriteModels || localOptionsData.default_rewrite_model,
      };
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      await refreshCore();
    } catch (error: any) {
      toast.error(error?.message || "Failed to load MLflow admin page");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!overview?.available || !selectedExperimentId) {
      setRuns([]);
      setSelectedRunId("");
      return;
    }

    let cancelled = false;
    setRunsLoading(true);
    api
      .listAdminMlflowExperimentRuns(selectedExperimentId, 25)
      .then((data) => {
        if (cancelled) return;
        setRuns(data);
        setSelectedRunId((current) => (data.some((run) => run.run_id === current) ? current : data[0]?.run_id ?? ""));
      })
      .catch((error: any) => {
        if (!cancelled) {
          setRuns([]);
          setSelectedRunId("");
          toast.error(error?.message || "Failed to load MLflow runs");
        }
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [overview?.available, selectedExperimentId]);

  useEffect(() => {
    if (!overview?.available || !selectedExperimentId || !selectedRunId) {
      setRunDetail(null);
      return;
    }

    let cancelled = false;
    setRunDetailLoading(true);
    api
      .getAdminMlflowRunDetail(selectedExperimentId, selectedRunId)
      .then((data) => {
        if (!cancelled) setRunDetail(data);
      })
      .catch((error: any) => {
        if (!cancelled) {
          setRunDetail(null);
          toast.error(error?.message || "Failed to load run detail");
        }
      })
      .finally(() => {
        if (!cancelled) setRunDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [overview?.available, selectedExperimentId, selectedRunId]);

  useEffect(() => {
    const activeJobs = jobs.some((job) => job.status === "queued" || job.status === "running");
    if (!activeJobs) return;

    const timer = window.setInterval(() => {
      void refreshCore().catch(() => {});
    }, 4000);
    return () => window.clearInterval(timer);
  }, [jobs]);

  const selectedExperiment = useMemo(
    () => overview?.experiments.find((experiment) => experiment.id === selectedExperimentId) ?? null,
    [overview, selectedExperimentId]
  );
  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === runForm.datasetId) ?? null,
    [datasets, runForm.datasetId]
  );
  const edgeReadiness = useMemo(() => computeEdgeReadiness(runDetail), [runDetail]);
  const runSummary = useMemo(() => {
    if (!runDetail) return null;
    const metricText =
      runDetail.primary_metric_key && runDetail.primary_metric_value != null
        ? `${metricName(runDetail.primary_metric_key)} scored ${formatMetricValue(runDetail.primary_metric_value)}.`
        : "This run did not log a primary score.";
    return {
      metricText,
      metricExplanation: explainMetric(runDetail.primary_metric_key),
      statusText:
        runDetail.status === "FINISHED"
          ? "This test finished, so you can compare it with other tests in the same group."
          : `This test is ${statusLabel(runDetail.status).toLowerCase()}, so the result may still change.`,
    };
  }, [runDetail]);
  const featuredMetrics = useMemo(() => {
    if (!runDetail) return [];
    return Object.entries(runDetail.metrics)
      .sort(([leftKey], [rightKey]) => metricPriority(leftKey) - metricPriority(rightKey))
      .slice(0, 4);
  }, [runDetail]);
  const secondaryMetrics = useMemo(() => {
    if (!runDetail) return [];
    const featuredKeys = new Set(featuredMetrics.map(([key]) => key));
    return Object.entries(runDetail.metrics)
      .filter(([key]) => !featuredKeys.has(key))
      .sort(([leftKey], [rightKey]) => metricPriority(leftKey) - metricPriority(rightKey));
  }, [featuredMetrics, runDetail]);
  const coreParams = useMemo(() => {
    if (!runDetail) return [];
    return Object.entries(runDetail.params).filter(([key]) => isCoreParam(key));
  }, [runDetail]);
  const secondaryParams = useMemo(() => {
    if (!runDetail) return [];
    return Object.entries(runDetail.params).filter(([key]) => !isCoreParam(key));
  }, [runDetail]);

  const applyPreset = (presetId: string) => {
    const preset = localOptions?.presets.find((entry) => entry.id === presetId);
    if (!preset) return;
    setRunForm((current) => ({
      ...current,
      inferenceModes: preset.inference_modes.join(", "),
      embeddingModels: preset.embedding_models.join(", "),
      zeroShotModels: preset.zero_shot_models.join(", "),
      rewriteModels: preset.rewrite_models.join(", "),
    }));
  };

  const handleLaunchExperiment = async () => {
    setLaunchingExperiment(true);
    try {
      const tags = Object.fromEntries(
        splitCsv(runForm.tags)
          .map((entry) => entry.split("=", 2))
          .filter(([key, value]) => key && value)
          .map(([key, value]) => [key.trim(), value.trim()])
      );
      const job = await api.launchAdminMlflowExperiment({
        experiment_name: runForm.experimentName.trim(),
        run_name: runForm.runName.trim() || undefined,
        dataset_id: runForm.datasetId,
        inference_modes: splitCsv(runForm.inferenceModes),
        embedding_models: splitCsv(runForm.embeddingModels),
        zero_shot_models: splitCsv(runForm.zeroShotModels),
        rewrite_models: splitCsv(runForm.rewriteModels),
        max_candidates: Number.parseInt(runForm.maxCandidates, 10) || 25,
        top_k: parseIntCsv(runForm.topK),
        skip_extraction: runForm.skipExtraction,
        skip_ranking: runForm.skipRanking,
        skip_rewrite: runForm.skipRewrite,
        tags,
      });
      setJobs((current) => [job, ...current.filter((entry) => entry.id !== job.id)].slice(0, 20));
      toast.success("MLflow experiment job launched");
    } catch (error: any) {
      toast.error(error?.message || "Failed to launch MLflow experiment");
    } finally {
      setLaunchingExperiment(false);
    }
  };

  const handleLaunchExport = async () => {
    setLaunchingExport(true);
    try {
      const job = await api.launchAdminMlflowDatasetExport({
        max_users: Number.parseInt(exportForm.maxUsers, 10) || 150,
        max_per_user: Number.parseInt(exportForm.maxPerUser, 10) || 6,
        negative_count: Number.parseInt(exportForm.negativeCount, 10) || 3,
        mongo_db: exportForm.mongoDb.trim() || undefined,
      });
      setJobs((current) => [job, ...current.filter((entry) => entry.id !== job.id)].slice(0, 20));
      toast.success("Dataset export job launched");
    } catch (error: any) {
      toast.error(error?.message || "Failed to launch dataset export");
    } finally {
      setLaunchingExport(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="max-w-7xl space-y-6">
        <AdminSectionNav />
        <Card className="border-slate-200 p-8 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-sm text-gray-600 dark:text-slate-300">Loading MLflow admin page...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      <AdminSectionNav />

      <Card className="overflow-hidden border-slate-200 p-0 dark:border-slate-800 dark:bg-slate-950">
        <div className={`${activeHeaderTheme.heroClass} px-8 py-8`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                <FlaskConical className={`h-3.5 w-3.5 ${activeHeaderTheme.accentTextClass}`} />
                Admin MLflow
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Model operations workspace</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Run tests, watch them finish, and read the results in plain English from one place.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void load()}
              className="border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Test groups</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{overview?.experiment_count ?? 0}</p>
            </div>
            <FlaskConical className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
        </Card>
        <Card className="border-slate-200 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Saved models</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{overview?.registered_model_count ?? 0}</p>
            </div>
            <Boxes className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
        </Card>
        <Card className="border-slate-200 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Test data</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{datasets.length}</p>
            </div>
            <DatabaseZap className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
        </Card>
        <Card className="border-slate-200 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Last update</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatTimestamp(overview?.latest_run_started_at)}</p>
            </div>
            <Clock3 className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
        </Card>
      </div>

      <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tracking URI</div>
        <div className="mt-2 break-all font-mono text-xs text-slate-700 dark:text-slate-200">{overview?.tracking_uri ?? "Unavailable"}</div>
      </Card>

      <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Quick Guide</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Three simple steps: pick test data, run a test, then compare the score.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="font-medium text-slate-900 dark:text-slate-100">1. Pick test data</div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Test data is the set of examples the model will be judged against.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="font-medium text-slate-900 dark:text-slate-100">2. Run a test</div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              A job is just the server running the test. Wait for a success state before trusting the result.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="font-medium text-slate-900 dark:text-slate-100">3. Read the score</div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Most scores are between 0 and 1. Bigger is better. Compare tests inside the same group first.
            </p>
          </div>
        </div>
      </Card>

      {!overview?.available ? (
        <Card className="border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="text-sm text-amber-800 dark:text-amber-200">
            {overview?.error || "MLflow is unavailable in the backend environment."}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Run a New Test</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">Choose your settings and start a comparison run.</p>
            </div>
            <Play className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="font-medium text-slate-900 dark:text-slate-100">Local Transformer Lab</div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Use these presets to compare local models with the fallback path. The goal is simple: find a local setup that is good enough and fast enough.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {(localOptions?.presets ?? []).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                >
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{preset.label}</div>
                  <div className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{preset.description}</div>
                </button>
              ))}
            </div>
            {localOptions ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Available Embeddings</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {localOptions.embedding_models.map((model) => (
                      <Badge key={model} variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                        {model.split("/").slice(-1)[0]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Available Zero-shot / Rewrite</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {localOptions.zero_shot_models.map((model) => (
                      <Badge key={`zero:${model}`} variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                        {model.split("/").slice(-1)[0]}
                      </Badge>
                    ))}
                    {localOptions.rewrite_models.map((model) => (
                      <Badge key={`rewrite:${model}`} className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {model.split("/").slice(-1)[0]}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="mlflow-experiment-name">Experiment Name</Label>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">A label for this group of tests.</p>
              <Input
                id="mlflow-experiment-name"
                value={runForm.experimentName}
                onChange={(event) => setRunForm((current) => ({ ...current, experimentName: event.target.value }))}
                className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </div>
            <div>
              <Label htmlFor="mlflow-run-name">Parent Run Name</Label>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Optional label for this launch.</p>
              <Input
                id="mlflow-run-name"
                value={runForm.runName}
                onChange={(event) => setRunForm((current) => ({ ...current, runName: event.target.value }))}
                placeholder="Optional"
                className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="mlflow-dataset">Dataset Bundle</Label>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Choose the test data to score against.</p>
              <Select value={runForm.datasetId} onValueChange={(value) => setRunForm((current) => ({ ...current, datasetId: value }))}>
                <SelectTrigger id="mlflow-dataset" className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                  <SelectValue placeholder="Choose dataset" />
                </SelectTrigger>
                <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDataset ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {selectedDataset.kind} dataset at {selectedDataset.path}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="mlflow-inference-modes">Inference Modes</Label>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">How the app should answer: local transformer or fallback.</p>
              <Input
                id="mlflow-inference-modes"
                value={runForm.inferenceModes}
                onChange={(event) => setRunForm((current) => ({ ...current, inferenceModes: event.target.value }))}
                className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </div>
            <div>
              <Label htmlFor="mlflow-top-k">Top K Values</Label>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">How many top results to judge.</p>
              <Input
                id="mlflow-top-k"
                value={runForm.topK}
                onChange={(event) => setRunForm((current) => ({ ...current, topK: event.target.value }))}
                className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </div>
            <div>
              <Label htmlFor="mlflow-embedding-models">Embedding Models</Label>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Models used to compare meaning and similarity.</p>
              <Input
                id="mlflow-embedding-models"
                value={runForm.embeddingModels}
                onChange={(event) => setRunForm((current) => ({ ...current, embeddingModels: event.target.value }))}
                className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </div>
            <div>
              <Label htmlFor="mlflow-zero-shot-models">Zero-shot Models</Label>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Models used to label skills without extra training.</p>
              <Input
                id="mlflow-zero-shot-models"
                value={runForm.zeroShotModels}
                onChange={(event) => setRunForm((current) => ({ ...current, zeroShotModels: event.target.value }))}
                className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </div>
            <div>
              <Label htmlFor="mlflow-rewrite-models">Rewrite Models</Label>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Models used to rewrite resume bullets.</p>
              <Input
                id="mlflow-rewrite-models"
                value={runForm.rewriteModels}
                onChange={(event) => setRunForm((current) => ({ ...current, rewriteModels: event.target.value }))}
                className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </div>
            <div>
              <Label htmlFor="mlflow-max-candidates">Max Candidates</Label>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">How many possible matches to consider.</p>
              <Input
                id="mlflow-max-candidates"
                value={runForm.maxCandidates}
                onChange={(event) => setRunForm((current) => ({ ...current, maxCandidates: event.target.value }))}
                className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </div>
            <div>
              <Label htmlFor="mlflow-tags">Tags</Label>
              <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Optional labels to help you find this test later.</p>
              <Input
                id="mlflow-tags"
                value={runForm.tags}
                onChange={(event) => setRunForm((current) => ({ ...current, tags: event.target.value }))}
                className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Skip Extraction</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Do not score skill finding.</p>
              </div>
              <Switch checked={runForm.skipExtraction} onCheckedChange={(checked) => setRunForm((current) => ({ ...current, skipExtraction: checked }))} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Skip Ranking</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Do not score match ranking.</p>
              </div>
              <Switch checked={runForm.skipRanking} onCheckedChange={(checked) => setRunForm((current) => ({ ...current, skipRanking: checked }))} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Skip Rewrite</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Do not score bullet rewriting.</p>
              </div>
              <Switch checked={runForm.skipRewrite} onCheckedChange={(checked) => setRunForm((current) => ({ ...current, skipRewrite: checked }))} />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={() => void handleLaunchExperiment()} disabled={launchingExperiment} className={activeHeaderTheme.buttonClass}>
              <Play className="mr-2 h-4 w-4" />
              {launchingExperiment ? "Launching..." : "Run Test"}
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create Test Data</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">Build a fresh dataset from Mongo for new comparisons.</p>
              </div>
              <DatabaseZap className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
            </div>

            <div className="grid gap-4">
              <div>
                <Label htmlFor="mlflow-export-users">Max Users</Label>
                <Input
                  id="mlflow-export-users"
                  value={exportForm.maxUsers}
                  onChange={(event) => setExportForm((current) => ({ ...current, maxUsers: event.target.value }))}
                  className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                />
              </div>
              <div>
                <Label htmlFor="mlflow-export-per-user">Max Per User</Label>
                <Input
                  id="mlflow-export-per-user"
                  value={exportForm.maxPerUser}
                  onChange={(event) => setExportForm((current) => ({ ...current, maxPerUser: event.target.value }))}
                  className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                />
              </div>
              <div>
                <Label htmlFor="mlflow-export-negative">Negative Count</Label>
                <Input
                  id="mlflow-export-negative"
                  value={exportForm.negativeCount}
                  onChange={(event) => setExportForm((current) => ({ ...current, negativeCount: event.target.value }))}
                  className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                />
              </div>
              <div>
                <Label htmlFor="mlflow-export-db">Mongo DB Override</Label>
                <Input
                  id="mlflow-export-db"
                  value={exportForm.mongoDb}
                  onChange={(event) => setExportForm((current) => ({ ...current, mongoDb: event.target.value }))}
                  placeholder="Optional"
                  className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="outline" onClick={() => void handleLaunchExport()} disabled={launchingExport} className="dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                <DatabaseZap className="mr-2 h-4 w-4" />
                {launchingExport ? "Launching..." : "Make Test Data"}
              </Button>
            </div>
          </Card>

          <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Saved Test Data</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">Pick from sample data or generated data.</p>
              </div>
              <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                {datasets.length} bundles
              </Badge>
            </div>
            <div className="space-y-3">
              {datasets.map((dataset) => (
                <div key={dataset.id} className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">{dataset.label}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{dataset.path}</div>
                    </div>
                    <Badge variant="outline" className="capitalize dark:border-slate-700 dark:text-slate-200">
                      {dataset.kind}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <span>Created {formatTimestamp(dataset.created_at)}</span>
                    {Object.entries(dataset.counts ?? {}).map(([key, value]) => (
                      <span key={`${dataset.id}:${key}`}>{key}: {value}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Live Jobs</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Watch tests start, run, and finish.</p>
          </div>
          <ScrollText className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {jobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No jobs yet.
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">{jobKindLabel(job.kind)}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{job.id}</div>
                  </div>
                  <Badge variant="outline" className={jobTone(job.status)}>
                    {statusLabel(job.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <span>Queued {formatTimestamp(job.created_at)}</span>
                  <span>Started {formatTimestamp(job.started_at)}</span>
                  <span>Finished {formatTimestamp(job.finished_at)}</span>
                </div>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{explainJobStatus(job.status)}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                  {Object.entries(job.summary).map(([key, value]) => (
                    <span key={`${job.id}:${key}`} className="rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
                      {key}: {value}
                    </span>
                  ))}
                </div>
                <div className="mt-3 rounded-xl bg-slate-950 px-3 py-3 font-mono text-[11px] text-slate-100">
                  {job.log_lines.length ? job.log_lines.slice(-12).join("\n") : "No logs yet."}
                </div>
                {job.error ? <div className="mt-3 text-sm text-rose-600 dark:text-rose-300">{job.error}</div> : null}
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Test Groups</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">Choose a group to compare test runs.</p>
            </div>
            <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
              {overview?.experiments.length ?? 0} tracked
            </Badge>
          </div>
          <div className="space-y-3">
            {(overview?.experiments ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No test groups found.
              </div>
            ) : (
              (overview?.experiments ?? []).map((experiment) => {
                const isActive = experiment.id === selectedExperimentId;
                const latestRun = experiment.latest_runs[0];
                return (
                  <button
                    key={experiment.id}
                    type="button"
                    onClick={() => setSelectedExperimentId(experiment.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700 dark:hover:bg-slate-950"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{experiment.name}</div>
                        <div className={`mt-1 text-xs ${isActive ? "text-white/80 dark:text-slate-700" : "text-slate-500 dark:text-slate-400"}`}>
                          ID {experiment.id} • {experiment.lifecycle_stage}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={isActive ? "border-white/30 bg-white/10 text-white dark:border-slate-300 dark:bg-slate-200 dark:text-slate-950" : "dark:border-slate-700 dark:text-slate-200"}
                      >
                        {experiment.run_count} runs
                      </Badge>
                    </div>
                    <div className={`mt-3 flex flex-wrap gap-3 text-xs ${isActive ? "text-white/85 dark:text-slate-700" : "text-slate-600 dark:text-slate-300"}`}>
                      <span>{formatMetricLabel(latestRun)}</span>
                      <span>Latest {formatTimestamp(experiment.latest_run_started_at)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Test Runs</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {selectedExperiment ? `Recent runs for ${selectedExperiment.name}. Click one to see the result.` : "Choose a test group first."}
              </p>
            </div>
            <Gauge className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
          <div className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader className="bg-slate-50/90 dark:bg-slate-950/80">
                <TableRow className="border-slate-200 dark:border-slate-800">
                  <TableHead className="text-slate-700 dark:text-slate-300">Run</TableHead>
                  <TableHead className="text-slate-700 dark:text-slate-300">Metric</TableHead>
                  <TableHead className="text-slate-700 dark:text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-700 dark:text-slate-300">Started</TableHead>
                  <TableHead className="text-slate-700 dark:text-slate-300">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsLoading ? (
                  <TableRow className="border-slate-200 dark:border-slate-800">
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      Loading experiment runs...
                    </TableCell>
                  </TableRow>
                ) : runs.length === 0 ? (
                  <TableRow className="border-slate-200 dark:border-slate-800">
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      {selectedExperimentId ? "No runs found for this test group." : "Choose a test group to view runs."}
                    </TableCell>
                  </TableRow>
                ) : (
                  runs.map((run) => {
                    const paramPreview = Object.entries(run.params)
                      .slice(0, 2)
                      .map(([key, value]) => `${key}=${value}`)
                      .join(" • ");
                    const active = run.run_id === selectedRunId;
                    return (
                      <TableRow
                        key={run.run_id}
                        className={`cursor-pointer border-slate-200 align-top dark:border-slate-800 dark:hover:bg-slate-950/60 ${active ? "bg-slate-50 dark:bg-slate-950/70" : ""}`}
                        onClick={() => setSelectedRunId(run.run_id)}
                      >
                        <TableCell className="whitespace-normal">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{run.run_name}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{run.run_id}</div>
                          {paramPreview ? <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">{paramPreview}</div> : null}
                        </TableCell>
                        <TableCell className="whitespace-normal text-sm text-slate-700 dark:text-slate-200">{formatMetricLabel(run)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize dark:border-slate-700 dark:text-slate-200">
                            {statusLabel(run.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(run.start_time)}</TableCell>
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400">{formatDuration(run.duration_seconds)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Selected Result</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">The chosen run explained in simple terms.</p>
            </div>
            <ScrollText className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>

          {runDetailLoading ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Loading run detail...
            </div>
          ) : !runDetail ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Pick a run to see the result.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Main score</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {runDetail.primary_metric_value != null ? formatMetricValue(runDetail.primary_metric_value) : "None"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {metricName(runDetail.primary_metric_key)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Run state</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{statusLabel(runDetail.status)}</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Current state of this test.</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Run time</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatDuration(runDetail.duration_seconds)}</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">How long this test took.</div>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 dark:border-sky-900 dark:bg-sky-950/30">
                <div className="font-medium text-sky-900 dark:text-sky-100">Plain-English Summary</div>
                <p className="mt-2 text-sm text-sky-900/90 dark:text-sky-100/90">{runSummary?.metricText}</p>
                <p className="mt-2 text-sm text-sky-800 dark:text-sky-200">{runSummary?.metricExplanation}</p>
                <p className="mt-2 text-sm text-sky-800 dark:text-sky-200">{runSummary?.statusText}</p>
              </div>

              <div className={`rounded-2xl border px-4 py-4 ${edgeReadiness.tone}`}>
                <div className="font-medium">{edgeReadiness.label}</div>
                <p className="mt-2 text-sm">{edgeReadiness.summary}</p>
                <p className="mt-2 text-xs opacity-80">
                  This is only a quick guide. Real device testing still matters.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{runDetail.run_name}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{runDetail.run_id}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>Primary {formatMetricLabel(runDetail)}</span>
                  <span>Status {statusLabel(runDetail.status)}</span>
                  <span>Started {formatTimestamp(runDetail.start_time)}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">Top Scores</div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">The most useful numbers to compare first.</p>
                  </div>
                  <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                    {Object.keys(runDetail.metrics).length} total
                  </Badge>
                </div>
                {featuredMetrics.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No scores logged.</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {featuredMetrics.map(([key, value]) => (
                      <div key={`${runDetail.run_id}:featured:${key}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/60">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{metricName(key)}</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatMetricValue(value)}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{key}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="mb-3 font-medium text-slate-900 dark:text-slate-100">Core Setup</div>
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">The main settings that shaped this test.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {coreParams.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">No settings logged.</div>
                    ) : (
                      coreParams.map(([key, value]) => (
                        <div key={`${runDetail.run_id}:core-param:${key}`} className="rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{paramName(key)}</div>
                          <div className="mt-2 break-all text-sm text-slate-900 dark:text-slate-100">{value}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="mb-3 font-medium text-slate-900 dark:text-slate-100">What To Check First</div>
                  <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
                    <div className="rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700">
                      <div className="font-medium text-slate-900 dark:text-slate-100">1. Compare the top score</div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use the same test group and same dataset when comparing runs.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700">
                      <div className="font-medium text-slate-900 dark:text-slate-100">2. Check speed</div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A better score may not be worth it if the model gets much slower.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700">
                      <div className="font-medium text-slate-900 dark:text-slate-100">3. Check the model setup</div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Only treat results as a fair comparison when the key settings are close.</p>
                    </div>
                  </div>
                </div>
              </div>

              <details className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                <summary className="cursor-pointer list-none font-medium text-slate-900 dark:text-slate-100">
                  More scores and settings
                </summary>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Open this only when you need the full technical detail.</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-3 font-medium text-slate-900 dark:text-slate-100">All Scores</div>
                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                      {secondaryMetrics.length === 0 ? (
                        <div className="text-slate-500 dark:text-slate-400">No extra scores.</div>
                      ) : (
                        secondaryMetrics.map(([key, value]) => (
                          <div key={`${runDetail.run_id}:metric:${key}`} className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="break-all">{metricName(key)}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{key}</div>
                            </div>
                            <span className="shrink-0 font-mono">{formatMetricValue(value)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mb-3 font-medium text-slate-900 dark:text-slate-100">All Settings</div>
                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                      {secondaryParams.length === 0 ? (
                        <div className="text-slate-500 dark:text-slate-400">No extra settings.</div>
                      ) : (
                        secondaryParams.map(([key, value]) => (
                          <div key={`${runDetail.run_id}:param:${key}`} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="break-all">{paramName(key)}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{key}</div>
                            </div>
                            <span className="max-w-[14rem] break-all text-right font-mono text-xs">{value}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </details>

              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="mb-3 font-medium text-slate-900 dark:text-slate-100">Saved Files</div>
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {runDetail.artifacts.length === 0 ? (
                    <div className="text-slate-500 dark:text-slate-400">No saved files found.</div>
                  ) : (
                    runDetail.artifacts.map((artifact) => (
                      <div key={`${runDetail.run_id}:artifact:${artifact.path}`} className="flex items-center justify-between gap-3">
                        <span className="break-all">{artifact.path || "/"}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {artifact.is_dir ? "directory" : artifact.file_size != null ? `${artifact.file_size} bytes` : "file"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="mb-3 font-medium text-slate-900 dark:text-slate-100">Sub-tests</div>
                <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {runDetail.child_runs.length === 0 ? (
                    <div className="text-slate-500 dark:text-slate-400">No sub-tests.</div>
                  ) : (
                    runDetail.child_runs.map((child) => (
                      <div key={child.run_id} className="rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{child.run_name}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{child.run_id}</div>
                        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">{formatMetricLabel(child)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Saved Models</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">Models that have been stored in MLflow.</p>
            </div>
            <Boxes className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
          <div className="grid gap-4">
            {(overview?.registered_models ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No saved models yet.
              </div>
            ) : (
              (overview?.registered_models ?? []).map((model) => (
                <div key={model.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{model.name}</div>
                      {model.description ? <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{model.description}</div> : null}
                    </div>
                    <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                      {model.latest_versions.length} versions
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-2">
                    {model.latest_versions.map((version) => (
                      <div key={`${model.name}:${version.version}`} className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">v{version.version}</Badge>
                        <span>{version.current_stage || "unassigned"}</span>
                        <span>{version.run_id ? `run ${version.run_id}` : "No run linked"}</span>
                        <span>{formatTimestamp(version.creation_timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
