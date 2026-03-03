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
import { Download, CheckCircle2, AlertCircle, Sparkles, Wand2, History, Trash2, RotateCw, Plus } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router";

type MatchResult = {
  job_id?: string;
  match_score?: number;
  match_confidence_label?: string;
  analysis_summary?: string;
  matched_skills?: string[];
  missing_skills?: string[];
  strength_areas?: string[];
  related_skills?: string[];
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
  semantic_alignment_score?: number;
  semantic_alignment_explanation?: string;
  history_id?: string | null;
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

  const [tailored, setTailored] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [history, setHistory] = useState<JobMatchHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoringHistoryId, setRestoringHistoryId] = useState<string | null>(null);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [reanalyzingHistoryId, setReanalyzingHistoryId] = useState<string | null>(null);
  const [addingMissingSkill, setAddingMissingSkill] = useState<string | null>(null);

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
      matchedSkills: asArray<string>(a.matched_skills ?? a.matchedSkills),
      missingSkills: asArray<string>(a.missing_skills ?? a.missingSkills),
      strengthAreas: asArray<string>(a.strength_areas ?? a.strengthAreas),
      relatedSkills: asArray<string>(a.related_skills ?? a.relatedSkills),
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
      keywordOverlapScore: Number(keywordOverlapBreakdown?.score ?? 0) || 0,
      semanticAlignmentScore: Number(a.semantic_alignment_score ?? a.semanticAlignmentScore ?? 0) || 0,
      semanticAlignmentExplanation: String(a.semantic_alignment_explanation ?? a.semanticAlignmentExplanation ?? ""),
      historyId: a.history_id ?? a.historyId ?? null,
    };
  }, [analysis]);

  const tailoredId = useMemo(
    () => String((tailored as any)?.id ?? (tailored as any)?.tailored_id ?? (tailored as any)?.tailoredId ?? "").trim(),
    [tailored]
  );

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
      // 3) Preview tailored resume (server stores the result and returns tailored_id)
      const preview = await api.previewTailoredResume({ job_id: jobId });
      setTailored(preview);
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
      toast.success("Tailored resume generated");
    } catch (error: any) {
      console.error("Failed to generate resume:", error);
      toast.error(error?.message || "Failed to generate resume");
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (kind: "pdf" | "docx") => {
    const tid = tailoredId;
    if (!tid) {
      toast.error("No tailored resume id found");
      return;
    }

    setExporting(kind);
    try {
      if (kind === "pdf") {
        const blob = await api.downloadTailoredPdf(String(tid));
        downloadBlob(blob, "tailored_resume.pdf");
      } else {
        const blob = await api.downloadTailoredDocx(String(tid));
        downloadBlob(blob, "tailored_resume.docx");
      }
      recordActivity({
        id: `jobs:export:${kind}:${tid}`,
        type: "resume",
        action: "exported",
        name: `${jobTitle || company || "Tailored resume"} (${kind.toUpperCase()})`,
      });
      toast.success("Export ready");
    } catch (error: any) {
      console.error("Export failed:", error);
      toast.error(error?.message || "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleReset = () => {
    setJobDescription("");
    setJobTitle("");
    setCompany("");
    setLocation("");
    setAnalysis(null);
      setTailored(null);
      setJobId(null);
    };

  const handleRewrite = async (focus: "balanced" | "ats" | "impact" = "balanced") => {
    if (!tailoredId) {
      toast.error("Generate a tailored resume first");
      return;
    }
    setRewriting(true);
    try {
      const rewritten = await api.rewriteTailoredResume(tailoredId, { focus });
      setTailored((current: any) => ({
        ...(current ?? {}),
        ...rewritten,
        id: tailoredId,
      }));
      recordActivity({
        id: `jobs:rewrite:${focus}:${tailoredId}`,
        type: "resume",
        action: "rewritten",
        name: `${jobTitle || company || "Tailored resume"} (${focus})`,
      });
      toast.success("Resume bullets enhanced");
    } catch (error: any) {
      console.error("Failed to rewrite tailored resume:", error);
      toast.error(error?.message || "Failed to rewrite tailored resume");
    } finally {
      setRewriting(false);
    }
  };

  const handleRestoreHistory = async (historyId: string) => {
    setRestoringHistoryId(historyId);
    try {
      const detail = await api.getJobMatchHistoryDetail(historyId);
      const restoredAnalysis = {
        ...(detail.analysis ?? {}),
        history_id: detail.id,
      };
      setAnalysis(restoredAnalysis as MatchResult);
      setJobId(String(detail.job_id ?? restoredAnalysis.job_id ?? "").trim() || null);
      setJobTitle(String(detail.title ?? "").trim());
      setCompany(String(detail.company ?? "").trim());
      setLocation(String(detail.location ?? "").trim());
      setJobDescription(String(detail.job_text ?? detail.text_preview ?? "").trim());
      setTailored(null);
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
        setTailored(null);
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Match</h1>
          <p className="text-gray-600">Paste a job description to get a detailed job match breakdown and generate a tailored resume</p>
        </div>

        <Card className="p-8">
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
              <p className="text-xs text-gray-500 mt-2">Include requirements, qualifications, and responsibilities for best results.</p>
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

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-[#1E3A8A]" />
            <h3 className="text-lg font-semibold text-gray-900">Last Analyzed Jobs</h3>
          </div>
          {historyLoading ? (
            <p className="text-sm text-gray-500">Loading previous analyses...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500">No prior analyses yet.</p>
          ) : (
            <div className="space-y-3">
              {history.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{entry.title || entry.company || "Saved job match"}</p>
                    <p className="text-sm text-gray-600">{[entry.company, entry.location].filter(Boolean).join(" • ")}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Match {Number(entry.match_score ?? 0)}% • {entry.created_at ? new Date(entry.created_at).toLocaleString() : "Saved"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-sm font-semibold ${getScoreColor(Number(entry.match_score ?? 0))}`}>{Number(entry.match_score ?? 0)}%</div>
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
          <h1 className="text-2xl font-bold text-gray-900">Job Match</h1>
          <p className="text-gray-600">Detailed score, skill gaps, and tailored resume generation</p>
        </div>
        <Button variant="outline" onClick={handleReset}>
          New Analysis
        </Button>
      </div>

      <Card className="p-8">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
          <div className="flex flex-col items-center rounded-2xl bg-slate-50 p-6 text-center">
            <span className={`text-5xl font-bold ${getScoreColor(normalized.matchScore)}`}>{normalized.matchScore}%</span>
            <span className="mt-1 text-sm text-gray-600">Match Score</span>
            <Badge className="mt-4 bg-white text-gray-700 border-gray-200">{normalized.confidenceLabel} Fit</Badge>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{jobTitle || "(job)"}</h2>
            <p className="text-gray-600">{company || ""}</p>
            {location ? <p className="text-sm text-gray-500 mt-1">{location}</p> : null}
            <p className="mt-4 text-sm leading-6 text-gray-700">
              {normalized.analysisSummary || "This score estimates how well your confirmed skills, supporting evidence, and related work align with the posting."}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-sm text-gray-500">Extracted Job Skills</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{normalized.extractedSkillCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Required Skills Covered</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {normalized.requiredMatchedCount}/{normalized.requiredSkillCount || normalized.extractedSkillCount || 0}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Evidence-Backed Matches</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{normalized.evidenceAlignedCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Evidence Gaps</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{normalized.evidenceGapCount}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-gray-500">Semantic Alignment</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{normalized.semanticAlignmentScore}%</p>
          <p className="mt-2 text-sm text-gray-600">
            {normalized.semanticAlignmentExplanation || "Semantic alignment looks beyond exact keyword matches and estimates how similar your saved work is to the role's themes and responsibilities."}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Coverage Snapshot</p>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            <p>Required skills matched: {normalized.requiredMatchedCount} of {normalized.requiredSkillCount}</p>
            <p>Preferred skills matched: {normalized.preferredMatchedCount} of {normalized.preferredSkillCount}</p>
            <p>Confirmed skills available overall: {normalized.confirmedSkillCount}</p>
            <p>Job keywords reflected in your work: {normalized.keywordOverlapScore}%</p>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Score Breakdown</h3>
          <p className="text-sm text-gray-600">The overall score weighs coverage of required skills, supporting evidence, and overlap with job language.</p>
        </div>
        <div className="space-y-4">
          {normalized.scoreBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500">No breakdown available.</p>
          ) : (
            normalized.scoreBreakdown.map((item) => {
              const score = Number(item?.score ?? 0) || 0;
              return (
                <div key={item?.label || score} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{item?.label || "Metric"}</p>
                      <p className="text-sm text-gray-600">{item?.detail || ""}</p>
                    </div>
                    <span className={`text-sm font-semibold ${getScoreColor(score)}`}>{score}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#1E3A8A]" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Matched Skills</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {normalized.matchedSkills.length === 0 ? (
              <span className="text-sm text-gray-500">None returned</span>
            ) : (
              normalized.matchedSkills.map((s) => (
                <Badge key={s} className="bg-green-50 text-green-700 border-green-200">
                  {s}
                </Badge>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Missing Skills</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {normalized.missingSkills.length === 0 ? (
              <span className="text-sm text-gray-500">None returned</span>
            ) : (
              normalized.missingSkills.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  onClick={() => handleAddMissingSkill(s)}
                  disabled={addingMissingSkill === s}
                  className="h-auto rounded-full border-orange-300 bg-white px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-50"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {addingMissingSkill === s ? "Adding..." : s}
                </Button>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-[#1E3A8A]" />
            <h3 className="font-semibold text-gray-900">Strength Areas</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {normalized.strengthAreas.length === 0 ? (
              <span className="text-sm text-gray-500">None returned</span>
            ) : (
              normalized.strengthAreas.map((s) => (
                <Badge key={s} className="bg-blue-50 text-[#1E3A8A] border-blue-200">
                  {s}
                </Badge>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-[#1E3A8A]" />
          <h3 className="font-semibold text-gray-900">Related Skills</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {normalized.relatedSkills.length === 0 ? (
            <span className="text-sm text-gray-500">No semantic skill matches returned.</span>
          ) : (
            normalized.relatedSkills.map((skill) => (
              <Badge key={skill} className="bg-slate-100 text-slate-700 border-slate-200">
                {skill}
              </Badge>
            ))
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="h-5 w-5 text-[#1E3A8A]" />
          <h3 className="font-semibold text-gray-900">Recommended Next Steps</h3>
        </div>
        {normalized.nextSteps.length === 0 ? (
          <p className="text-sm text-gray-500">No immediate next steps. Your saved profile data is already aligned well with this job.</p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-700">
            {normalized.nextSteps.map((step) => (
              <li key={step} className="rounded-md bg-slate-50 px-3 py-2">
                {step}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Tailored Resume</h3>
            <p className="text-sm text-gray-600">Generate a preview then export as PDF/DOCX.</p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerateResume}
              disabled={generating || !jobId}
              className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
            >
              {generating ? "Generating..." : "Generate"}
            </Button>

            <Button variant="outline" disabled={!tailored || exporting === "pdf"} onClick={() => handleExport("pdf")}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting === "pdf" ? "Exporting..." : "PDF"}
            </Button>

            <Button variant="outline" disabled={!tailored || exporting === "docx"} onClick={() => handleExport("docx")}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting === "docx" ? "Exporting..." : "DOCX"}
            </Button>

            <Button variant="outline" disabled={!tailored || rewriting} onClick={() => handleRewrite("balanced")}>
              <Wand2 className="h-4 w-4 mr-2" />
              {rewriting ? "Enhancing..." : "Enhance Bullets"}
            </Button>
          </div>
        </div>

        {tailored ? (
          <div className="mt-4 space-y-4">
            <div className="text-sm text-gray-600">
              Preview generated. Tailored id: <span className="font-mono">{String((tailored as any).id ?? (tailored as any).tailored_id ?? "")}</span>
            </div>
            <div className="space-y-4">
              {asArray<any>((tailored as any)?.sections).map((section) => (
                <div key={String(section?.title ?? "")} className="rounded-lg border border-gray-200 p-4">
                  <h4 className="font-semibold text-gray-900">{String(section?.title ?? "")}</h4>
                  <div className="mt-2 space-y-2 text-sm text-gray-700">
                    {asArray<string>(section?.lines).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-gray-500">Generate to create a tailored resume preview.</div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-[#1E3A8A]" />
              <h3 className="text-lg font-semibold text-gray-900">Saved Job Match History</h3>
            </div>
            <p className="text-sm text-gray-600">Compare recent job analyses and see how match quality changes across postings.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {historyLoading ? (
            <p className="text-sm text-gray-500">Loading saved analyses...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500">No saved analyses yet. Run a Job Match analysis to populate history.</p>
          ) : (
            history.map((entry) => {
              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{entry.title || entry.company || "Saved job match"}</p>
                      <p className="text-sm text-gray-600">{[entry.company, entry.location].filter(Boolean).join(" • ")}</p>
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
                      <Badge key={`${entry.id}:${skill}`} className="bg-green-50 text-green-700 border-green-200">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    Semantic: {Number(entry.semantic_alignment_score ?? 0)}% • {entry.created_at ? new Date(entry.created_at).toLocaleString() : "Saved"}
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
