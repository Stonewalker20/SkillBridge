import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import { useActivity } from "../context/ActivityContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import type { JobMatchHistoryEntry } from "../services/api";
import { Download, CheckCircle2, AlertCircle, Sparkles, History, Trash2, RotateCw, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router";

type MatchResult = {
  job_id?: string;
  match_score?: number;
  match_confidence_label?: string;
  analysis_summary?: string;
  ignored_skill_names?: string[];
  matched_skills?: string[];
  missing_skills?: string[];
  matched_skill_count?: number;
  missing_skill_count?: number;
  strength_areas?: string[];
  related_skills?: string[];
  semantic_alignment_examples?: string[];
  score_breakdown?: Array<{ label?: string; score?: number; detail?: string }>;
  recommended_next_steps?: string[];
  extracted_skill_count?: number;
  confirmed_skill_count?: number;
  required_skill_count?: number;
  required_matched_count?: number;
  preferred_skill_count?: number;
  preferred_matched_count?: number;
  evidence_aligned_count?: number;
  evidence_gap_count?: number;
  keyword_overlap_count?: number;
  keyword_overlap_terms?: string[];
  semantic_alignment_score?: number;
  semantic_alignment_explanation?: string;
  history_id?: string | null;
  tailored_resume_id?: string | null;
  [k: string]: any;
};

const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function Jobs() {
  const { recordActivity } = useActivity();
  const [searchParams, setSearchParams] = useSearchParams();
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MatchResult | null>(null);

  const [lastTailoredId, setLastTailoredId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<JobMatchHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoringHistoryId, setRestoringHistoryId] = useState<string | null>(null);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [reanalyzingHistoryId, setReanalyzingHistoryId] = useState<string | null>(null);
  const [addingMissingSkill, setAddingMissingSkill] = useState<string | null>(null);
  const [updatingIgnoredSkill, setUpdatingIgnoredSkill] = useState<string | null>(null);

  const normalized = useMemo(() => {
    const a = analysis || {};
    const scoreBreakdown = asArray<{ label?: string; score?: number; detail?: string }>(a.score_breakdown ?? a.scoreBreakdown);
    const keywordOverlapBreakdown = scoreBreakdown.find(
      (item) => String(item?.label ?? "").toLowerCase() === "keyword overlap"
    );
    return {
      matchScore: Number(a.match_score ?? a.matchScore ?? 0) || 0,
      confidenceLabel: String(a.match_confidence_label ?? a.matchConfidenceLabel ?? "Early"),
      analysisSummary: String(a.analysis_summary ?? a.analysisSummary ?? ""),
      ignoredSkills: asArray<string>(a.ignored_skill_names ?? a.ignoredSkills),
      matchedSkills: asArray<string>(a.matched_skills ?? a.matchedSkills),
      missingSkills: asArray<string>(a.missing_skills ?? a.missingSkills),
      matchedSkillCount: Number(a.matched_skill_count ?? a.matchedSkillCount ?? asArray<string>(a.matched_skills ?? a.matchedSkills).length) || 0,
      missingSkillCount: Number(a.missing_skill_count ?? a.missingSkillCount ?? asArray<string>(a.missing_skills ?? a.missingSkills).length) || 0,
      strengthAreas: asArray<string>(a.strength_areas ?? a.strengthAreas),
      relatedSkills: asArray<string>(a.related_skills ?? a.relatedSkills),
      semanticAlignmentExamples: asArray<string>(a.semantic_alignment_examples ?? a.semanticAlignmentExamples),
      scoreBreakdown,
      nextSteps: asArray<string>(a.recommended_next_steps ?? a.recommendedNextSteps),
      extractedSkillCount: Number(a.extracted_skill_count ?? a.extractedSkillCount ?? 0) || 0,
      confirmedSkillCount: Number(a.confirmed_skill_count ?? a.confirmedSkillCount ?? 0) || 0,
      requiredSkillCount: Number(a.required_skill_count ?? a.requiredSkillCount ?? 0) || 0,
      requiredMatchedCount: Number(a.required_matched_count ?? a.requiredMatchedCount ?? 0) || 0,
      preferredSkillCount: Number(a.preferred_skill_count ?? a.preferredSkillCount ?? 0) || 0,
      preferredMatchedCount: Number(a.preferred_matched_count ?? a.preferredMatchedCount ?? 0) || 0,
      evidenceAlignedCount: Number(a.evidence_aligned_count ?? a.evidenceAlignedCount ?? 0) || 0,
      evidenceGapCount: Number(a.evidence_gap_count ?? a.evidenceGapCount ?? 0) || 0,
      keywordOverlapCount: Number(a.keyword_overlap_count ?? a.keywordOverlapCount ?? 0) || 0,
      keywordOverlapTerms: asArray<string>(a.keyword_overlap_terms ?? a.keywordOverlapTerms),
      keywordOverlapScore: Number(keywordOverlapBreakdown?.score ?? 0) || 0,
      semanticAlignmentScore: Number(a.semantic_alignment_score ?? a.semanticAlignmentScore ?? 0) || 0,
      semanticAlignmentExplanation: String(a.semantic_alignment_explanation ?? a.semanticAlignmentExplanation ?? ""),
      historyId: a.history_id ?? a.historyId ?? null,
      tailoredResumeId: a.tailored_resume_id ?? a.tailoredResumeId ?? null,
    };
  }, [analysis]);

  const handleReset = () => {
    setJobDescription("");
    setJobTitle("");
    setCompany("");
    setLocation("");
    setAnalysis(null);
    setLastTailoredId(null);
    setJobId(null);
  };

  useEffect(() => {
    const newToken = searchParams.get("new");
    if (!newToken) return;

    handleReset();
    descriptionRef.current?.focus();
    descriptionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get("analyze") === "1" && !analysis) {
      descriptionRef.current?.focus();
      descriptionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      const next = new URLSearchParams(searchParams);
      next.delete("analyze");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, analysis]);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const entries = await api.listJobMatchHistory(8);
        if (active) setHistory(entries);
      } catch (error) {
        console.error("Failed to load job match history:", error);
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    loadHistory();
    return () => {
      active = false;
    };
  }, []);

  const refreshHistory = async () => {
    const entries = await api.listJobMatchHistory(8);
    setHistory(entries);
    return entries;
  };

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      toast.error("Please paste a job description");
      return;
    }

    setAnalyzing(true);
    try {
      // 1) Ingest job text
      const ingested = await api.ingestJob({
        title: jobTitle || undefined,
        company: company || undefined,
        location: location || undefined,
        text: jobDescription,
      });

      const jid = (ingested as any)?.job_id ?? (ingested as any)?.id;
      if (!jid) throw new Error("Backend did not return a job id");

      setJobId(String(jid));

      // 2) Match job
      const match = await api.matchJob({ job_id: String(jid) });
      setAnalysis(match as any);
      setLastTailoredId(String((match as any)?.tailored_resume_id ?? (match as any)?.tailoredResumeId ?? "").trim() || null);
      try {
        await refreshHistory();
      } catch (historyError) {
        console.error("Failed to refresh job match history:", historyError);
      }
      recordActivity({
        id: `jobs:analyze:${jid}`,
        type: "jobs",
        action: "analyzed",
        name: jobTitle || company || "Job posting",
      });
      toast.success("Job analysis complete");
    } catch (error: any) {
      console.error("Failed to analyze job:", error);
      toast.error(error?.message || "Failed to analyze job");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateResume = async () => {
    if (!jobId) return;

    setGenerating(true);
    try {
      const preview = await api.previewTailoredResume({
        job_id: jobId,
        ignored_skill_names: normalized.ignoredSkills,
      });
      const previewId = String((preview as any)?.id ?? (preview as any)?.tailored_id ?? (preview as any)?.tailoredId ?? "").trim();
      if (!previewId) {
        throw new Error("Tailored resume was created without an export id");
      }
      setLastTailoredId(previewId);
      setAnalysis((current) => (current ? { ...current, tailored_resume_id: previewId } : current));
      const blob = await api.downloadTailoredPdf(previewId);
      downloadBlob(blob, "tailored_resume.pdf");
      try {
        await refreshHistory();
      } catch (historyError) {
        console.error("Failed to refresh job match history:", historyError);
      }
      recordActivity({
        id: `jobs:tailor:${jobId}`,
        type: "resume",
        action: "generated",
        name: jobTitle || company || "Tailored resume",
      });
      recordActivity({
        id: `jobs:export:pdf:${previewId}`,
        type: "resume",
        action: "exported",
        name: `${jobTitle || company || "Tailored resume"} (PDF)`,
      });
      toast.success("Tailored resume PDF downloaded");
    } catch (error: any) {
      console.error("Failed to generate resume:", error);
      toast.error(error?.message || "Failed to generate tailored resume PDF");
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateIgnoredSkills = async (skillName: string, shouldIgnore: boolean) => {
    const normalizedName = String(skillName || "").trim();
    const currentIgnored = normalized.ignoredSkills;
    if (!jobId || !normalizedName) return;

    const nextIgnored = shouldIgnore
      ? Array.from(new Set([...currentIgnored, normalizedName]))
      : currentIgnored.filter((value) => value !== normalizedName);

    setUpdatingIgnoredSkill(normalizedName);
    try {
      const match = await api.matchJob({
        job_id: jobId,
        ignored_skill_names: nextIgnored,
        persist_history: false,
      });
      setAnalysis((current) => ({
        ...(current ?? {}),
        ...(match as MatchResult),
        history_id: current?.history_id ?? (match as any)?.history_id ?? null,
        tailored_resume_id: current?.tailored_resume_id ?? (match as any)?.tailored_resume_id ?? null,
      }));
      toast.success(shouldIgnore ? `Removed ${normalizedName} from this analysis` : `Added ${normalizedName} back to this analysis`);
    } catch (error: any) {
      console.error("Failed to update ignored job skills:", error);
      toast.error(error?.message || "Failed to update the analysis");
    } finally {
      setUpdatingIgnoredSkill(null);
    }
  };

  const handleRestoreHistory = async (historyId: string) => {
    setRestoringHistoryId(historyId);
    try {
      const detail = await api.getJobMatchHistoryDetail(historyId);
      const restoredAnalysis = {
        ...(detail.analysis ?? {}),
        history_id: detail.id,
        tailored_resume_id: detail.tailored_resume_id ?? null,
      };
      setAnalysis(restoredAnalysis as MatchResult);
      setJobId(String(detail.job_id ?? restoredAnalysis.job_id ?? "").trim() || null);
      setJobTitle(String(detail.title ?? "").trim());
      setCompany(String(detail.company ?? "").trim());
      setLocation(String(detail.location ?? "").trim());
      setJobDescription(String(detail.job_text ?? detail.text_preview ?? "").trim());
      setLastTailoredId(String(detail.tailored_resume_id ?? "").trim() || null);
      toast.success("Restored previous job analysis");
    } catch (error: any) {
      console.error("Failed to restore job match history:", error);
      toast.error(error?.message || "Failed to restore previous analysis");
    } finally {
      setRestoringHistoryId(null);
    }
  };

  const handleDeleteHistory = async (entry: JobMatchHistoryEntry) => {
    if (!window.confirm(`Delete saved job analysis "${entry.title || entry.company || "Saved job match"}"?`)) return;

    setDeletingHistoryId(entry.id);
    try {
      await api.deleteJobMatchHistory(entry.id);
      setHistory((current) => current.filter((item) => item.id !== entry.id));
      if (normalized.historyId === entry.id) {
        setAnalysis(null);
        setLastTailoredId(null);
        setJobId(null);
      }
      recordActivity({
        id: `jobs:history:delete:${entry.id}`,
        type: "jobs",
        action: "deleted",
        name: entry.title || entry.company || "Saved job match",
      });
      toast.success("Saved job analysis deleted");
    } catch (error: any) {
      console.error("Failed to delete job match history:", error);
      toast.error(error?.message || "Failed to delete saved analysis");
    } finally {
      setDeletingHistoryId(null);
    }
  };

  const handleReanalyzeHistory = async (entry: JobMatchHistoryEntry) => {
    const historyJobId = String(entry.job_id ?? "").trim();
    if (!historyJobId) {
      toast.error("This saved analysis is missing its job id");
      return;
    }

    setReanalyzingHistoryId(entry.id);
    try {
      await api.matchJob({ job_id: historyJobId });
      await refreshHistory();

      recordActivity({
        id: `jobs:reanalyze:${entry.id}`,
        type: "jobs",
        action: "reanalyzed",
        name: entry.title || entry.company || "Saved job match",
      });
      toast.success("New job match analysis saved");
    } catch (error: any) {
      console.error("Failed to reanalyze job match:", error);
      toast.error(error?.message || "Failed to reanalyze job match");
    } finally {
      setReanalyzingHistoryId(null);
    }
  };

  const handleAddMissingSkill = async (skillName: string) => {
    const normalizedName = String(skillName || "").trim();
    if (!normalizedName) return;

    setAddingMissingSkill(normalizedName);
    try {
      const matches = await api.listSkills({ q: normalizedName, limit: 50 });
      const exactMatch = matches.find((skill) => String(skill.name || "").trim().toLowerCase() === normalizedName.toLowerCase());

      let skillId = exactMatch?.id;
      if (!skillId) {
        const created = await api.createSkill({
          name: normalizedName,
          category: "General",
        });
        skillId = created.id;
      }

      await api.confirmSkill(null, skillId);

      setAnalysis((current) => {
        if (!current) return current;
        const currentMissing = asArray<string>(current.missing_skills).filter((value) => value !== normalizedName);
        const currentMatched = asArray<string>(current.matched_skills);
        return {
          ...current,
          missing_skills: currentMissing,
          matched_skills: currentMatched.includes(normalizedName) ? currentMatched : [...currentMatched, normalizedName],
          confirmed_skill_count: Number(current.confirmed_skill_count ?? current.confirmedSkillCount ?? 0) + 1,
        };
      });

      recordActivity({
        id: `jobs:missing-skill:add:${normalizedName}`,
        type: "skills",
        action: "confirmed",
        name: normalizedName,
      });
      toast.success("Skill added to your profile. Reanalyze to update the score.");
    } catch (error: any) {
      console.error("Failed to add missing skill:", error);
      toast.error(error?.message || "Failed to add missing skill");
    } finally {
      setAddingMissingSkill(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-[#0D9488]";
    return "text-orange-600";
  };

  if (!analysis) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-slate-100">Job Match</h1>
          <p className="text-gray-600 dark:text-slate-300">Paste a job description to get a detailed job match breakdown and generate a tailored resume</p>
        </div>

        <Card className="p-8 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="job-title">Job Title (Optional)</Label>
                <Input
                  id="job-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g., ML Engineer"
                />
              </div>
              <div>
                <Label htmlFor="company">Company (Optional)</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g., Acme" />
              </div>
              <div>
                <Label htmlFor="location">Location (Optional)</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Remote"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="job-description">Job Description *</Label>
              <Textarea
                id="job-description"
                ref={descriptionRef}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here..."
                rows={12}
                className="font-mono text-sm"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Include requirements, qualifications, and responsibilities for best results.</p>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={analyzing || !jobDescription.trim()}
              className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90 h-12 text-base"
            >
              {analyzing ? (
                <>
                  <Sparkles className="h-5 w-5 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Analyze Job Match
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-[#1E3A8A]" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Last Analyzed Jobs</h3>
          </div>
          {historyLoading ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">Loading previous analyses...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">No prior analyses yet.</p>
          ) : (
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-2">
              {history.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-950/60">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-slate-100">{entry.title || entry.company || "Saved job match"}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-300">{[entry.company, entry.location].filter(Boolean).join(" • ")}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      Match {Number(entry.match_score ?? 0)}% • {entry.created_at ? new Date(entry.created_at).toLocaleString() : "Saved"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-sm font-semibold ${getScoreColor(Number(entry.match_score ?? 0))}`}>{Number(entry.match_score ?? 0)}%</div>
                    {entry.tailored_resume_id ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Resume ready
                      </Badge>
                    ) : null}
                    <Button variant="outline" onClick={() => handleRestoreHistory(entry.id)} disabled={restoringHistoryId === entry.id}>
                      {restoringHistoryId === entry.id ? "Opening..." : "Open"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleReanalyzeHistory(entry)}
                      disabled={reanalyzingHistoryId === entry.id}
                    >
                      <RotateCw className={`mr-2 h-4 w-4 ${reanalyzingHistoryId === entry.id ? "animate-spin" : ""}`} />
                      {reanalyzingHistoryId === entry.id ? "Updating..." : "Reanalyze"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleDeleteHistory(entry)}
                      disabled={deletingHistoryId === entry.id}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Delete ${entry.title || entry.company || "saved job analysis"}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Job Match</h1>
          <p className="text-gray-600 dark:text-slate-300">Detailed score, skill gaps, and tailored resume generation</p>
        </div>
        <Button variant="outline" onClick={handleReset}>
          New Analysis
        </Button>
      </div>

      <Card className="p-8 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
          <div className="flex flex-col items-center rounded-2xl bg-slate-50 p-6 text-center dark:bg-slate-950/70">
            <span className={`text-5xl font-bold ${getScoreColor(normalized.matchScore)}`}>{normalized.matchScore}%</span>
            <span className="mt-1 text-sm text-gray-600 dark:text-slate-300">Match Score</span>
            <Badge className="mt-4 border-gray-200 bg-white text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{normalized.confidenceLabel} Fit</Badge>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">{jobTitle || "(job)"}</h2>
            <p className="text-gray-600 dark:text-slate-300">{company || ""}</p>
            {location ? <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{location}</p> : null}
            <p className="mt-4 text-sm leading-6 text-gray-700 dark:text-slate-200">
              {normalized.analysisSummary || "This score estimates how well your confirmed skills, supporting evidence, and related work align with the posting."}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Extracted Job Skills</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{normalized.extractedSkillCount}</p>
        </Card>
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Required Skills Covered</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">
            {normalized.requiredMatchedCount}/{normalized.requiredSkillCount || normalized.extractedSkillCount || 0}
          </p>
        </Card>
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Matched Job Skills</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{normalized.matchedSkillCount}</p>
        </Card>
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Missing Job Skills</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{normalized.missingSkillCount}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Semantic Alignment</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{normalized.semanticAlignmentScore}%</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
            {normalized.semanticAlignmentExplanation || "Semantic alignment looks beyond exact keyword matches and estimates how similar your saved work is to the role's themes and responsibilities."}
          </p>
        </Card>
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Coverage Snapshot</p>
          <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-slate-200">
            <p>Matched job skills: {normalized.matchedSkillCount} of {normalized.extractedSkillCount}</p>
            <p>Missing job skills: {normalized.missingSkillCount} of {normalized.extractedSkillCount}</p>
            <p>Required skills matched: {normalized.requiredMatchedCount} of {normalized.requiredSkillCount}</p>
            <p>Preferred skills matched: {normalized.preferredMatchedCount} of {normalized.preferredSkillCount}</p>
            <p>Evidence-backed matched skills: {normalized.evidenceAlignedCount} of {normalized.matchedSkillCount}</p>
            <p>Job keywords reflected in your work: {normalized.keywordOverlapScore}%</p>
          </div>
          {normalized.keywordOverlapTerms.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Keywords Overlapped</p>
              <div className="flex flex-wrap gap-2">
                {normalized.keywordOverlapTerms.map((term) => (
                  <Badge key={term} className="border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {term}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
        <p className="text-sm text-gray-500 dark:text-slate-400">Semantic Alignment Examples</p>
        {normalized.semanticAlignmentExamples.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600 dark:text-slate-300">No concrete examples yet. Add more evidence or projects tied to your confirmed skills to strengthen semantic matching.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-slate-200">
            {normalized.semanticAlignmentExamples.map((example) => (
              <li key={example} className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950/70">
                {example}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Score Breakdown</h3>
          <p className="text-sm text-gray-600 dark:text-slate-300">The overall score weighs coverage of required skills, supporting evidence, and overlap with job language.</p>
        </div>
        <div className="space-y-4">
          {normalized.scoreBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">No breakdown available.</p>
          ) : (
            normalized.scoreBreakdown.map((item) => {
              const score = Number(item?.score ?? 0) || 0;
              return (
                <div key={item?.label || score} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-slate-100">{item?.label || "Metric"}</p>
                      <p className="text-sm text-gray-600 dark:text-slate-300">{item?.detail || ""}</p>
                    </div>
                    <span className={`text-sm font-semibold ${getScoreColor(score)}`}>{score}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-[#1E3A8A]" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Matched Skills</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {normalized.matchedSkills.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-slate-400">None returned</span>
            ) : (
              normalized.matchedSkills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-200"
                >
                  <span>{s}</span>
                  <button
                    type="button"
                    onClick={() => handleUpdateIgnoredSkills(s, true)}
                    disabled={updatingIgnoredSkill === s}
                    className="rounded-full p-0.5 text-current transition hover:bg-black/10 disabled:opacity-50 dark:hover:bg-white/10"
                    aria-label={`Remove ${s} from this analysis`}
                    title="Remove from this analysis"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Missing Skills</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {normalized.missingSkills.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-slate-400">None returned</span>
            ) : (
              normalized.missingSkills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-white px-1.5 py-1 text-sm font-medium text-orange-700 dark:border-orange-900/60 dark:bg-slate-900 dark:text-orange-200"
                >
                  <Button
                    variant="ghost"
                    onClick={() => handleAddMissingSkill(s)}
                    disabled={addingMissingSkill === s}
                    className="h-auto rounded-full px-1.5 py-0 text-sm font-medium text-orange-700 hover:bg-orange-50 dark:text-orange-200 dark:hover:bg-orange-950/40"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {addingMissingSkill === s ? "Adding..." : s}
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleUpdateIgnoredSkills(s, true)}
                    disabled={updatingIgnoredSkill === s}
                    className="rounded-full p-0.5 text-current transition hover:bg-black/10 disabled:opacity-50 dark:hover:bg-white/10"
                    aria-label={`Remove ${s} from this analysis`}
                    title="Remove from this analysis"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-[#1E3A8A]" />
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Strength Areas</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {normalized.strengthAreas.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-slate-400">None returned</span>
            ) : (
              normalized.strengthAreas.map((s) => (
                <Badge key={s} className="border-blue-200 bg-blue-50 text-[#1E3A8A] dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-200">
                  {s}
                </Badge>
              ))
            )}
          </div>
        </Card>
      </div>

      {normalized.ignoredSkills.length > 0 ? (
        <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="h-5 w-5 text-slate-500" />
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Ignored Skills</h3>
          </div>
          <p className="mb-4 text-sm text-gray-600 dark:text-slate-300">
            These extracted skills have been removed from the current job analysis so they do not affect counts, coverage, or score.
          </p>
          <div className="flex flex-wrap gap-2">
            {normalized.ignoredSkills.map((skill) => (
              <Button
                key={skill}
                variant="outline"
                onClick={() => handleUpdateIgnoredSkills(skill, false)}
                disabled={updatingIgnoredSkill === skill}
                className="h-auto rounded-full border-slate-300 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {updatingIgnoredSkill === skill ? "Restoring..." : `Restore ${skill}`}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-[#1E3A8A]" />
          <h3 className="font-semibold text-gray-900 dark:text-slate-100">Related Skills</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {normalized.relatedSkills.length === 0 ? (
            <span className="text-sm text-gray-500 dark:text-slate-400">No semantic skill matches returned.</span>
          ) : (
            normalized.relatedSkills.map((skill) => (
              <Badge key={skill} className="border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {skill}
              </Badge>
            ))
          )}
        </div>
      </Card>

      <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="h-5 w-5 text-[#1E3A8A]" />
          <h3 className="font-semibold text-gray-900 dark:text-slate-100">Recommended Next Steps</h3>
        </div>
        {normalized.nextSteps.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">No immediate next steps. Your saved profile data is already aligned well with this job.</p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-700 dark:text-slate-200">
            {normalized.nextSteps.map((step) => (
              <li key={step} className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950/70">
                {step}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Tailored Resume</h3>
            <p className="text-sm text-gray-600 dark:text-slate-300">Generate and download a tailored resume PDF without showing the full resume text on the page.</p>
          </div>

          <Button
            onClick={handleGenerateResume}
            disabled={generating || !jobId}
            className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
          >
            <Download className="mr-2 h-4 w-4" />
            {generating ? "Generating PDF..." : "Generate PDF"}
          </Button>
        </div>

        {lastTailoredId ? (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200">
            Tailored resume generated and downloaded. Resume id: <span className="font-mono">{lastTailoredId}</span>
          </div>
        ) : (
          <div className="mt-4 text-sm text-gray-500 dark:text-slate-400">Generate PDF to create and download your tailored resume.</div>
        )}
      </Card>

      <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-[#1E3A8A]" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Saved Job Match History</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300">Compare recent job analyses and see how match quality changes across postings.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {historyLoading ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">Loading saved analyses...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">No saved analyses yet. Run a Job Match analysis to populate history.</p>
          ) : (
            history.map((entry) => {
              return (
                <div
                  key={entry.id}
                  className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:bg-slate-900/80"
                  onClick={() => handleRestoreHistory(entry.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleRestoreHistory(entry.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-slate-100">{entry.title || entry.company || "Saved job match"}</p>
                      <p className="text-sm text-gray-600 dark:text-slate-300">{[entry.company, entry.location].filter(Boolean).join(" • ")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${getScoreColor(Number(entry.match_score ?? 0))}`}>{Number(entry.match_score ?? 0)}%</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleReanalyzeHistory(entry);
                        }}
                        disabled={reanalyzingHistoryId === entry.id}
                      >
                        <RotateCw className={`h-4 w-4 ${reanalyzingHistoryId === entry.id ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteHistory(entry);
                        }}
                        disabled={deletingHistoryId === entry.id}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Delete ${entry.title || entry.company || "saved job analysis"}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {asArray<string>(entry.matched_skills).slice(0, 4).map((skill) => (
                      <Badge key={`${entry.id}:${skill}`} className="border-green-200 bg-green-50 text-green-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
                    Semantic: {Number(entry.semantic_alignment_score ?? 0)}% • {entry.created_at ? new Date(entry.created_at).toLocaleString() : "Saved"}
                    {entry.tailored_resume_id ? " • Resume ready" : ""}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
