import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Evidence, type RewardsSummary } from "../services/api";
import { useActivity } from "../context/ActivityContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import type { JobMatchHistoryEntry, ResumeSnapshotListEntry } from "../services/api";
import { Download, CheckCircle2, AlertCircle, Sparkles, History, Trash2, RotateCw, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router";
import { getHeaderThemeSoftPanelClass, useHeaderTheme } from "../lib/headerTheme";
import { useAccountPreferences } from "../context/AccountPreferencesContext";

type RetrievedContextItem = {
  source_type: string;
  source_id: string;
  title: string;
  snippet: string;
  score: number;
  chunk_index?: number;
  evidence_name?: string;
  supporting_excerpt?: string;
};

type BreakdownIncludedItem = {
  label?: string;
  detail?: string;
};

type GapInsightItem = {
  skill_id: string;
  skill_name: string;
  gap_type: string;
  severity: string;
  reason: string;
  recommended_action: string;
};

type MatchResult = {
  job_id?: string;
  match_score?: number;
  match_confidence_label?: string;
  analysis_summary?: string;
  resume_snapshot_id?: string | null;
  resume_evidence_id?: string | null;
  template_source?: string | null;
  ignored_skill_names?: string[];
  added_from_missing_skills?: Array<{ skill_id: string; skill_name: string }>;
  matched_skill_ids?: string[];
  missing_skill_ids?: string[];
  matched_skills?: string[];
  missing_skills?: string[];
  matched_skill_count?: number;
  missing_skill_count?: number;
  strength_areas?: string[];
  related_skills?: string[];
  semantic_alignment_examples?: string[];
  retrieved_context?: RetrievedContextItem[];
  gap_reasoning_summary?: string;
  gap_insights?: GapInsightItem[];
  score_breakdown?: Array<{ label?: string; score?: number; detail?: string; included_items?: BreakdownIncludedItem[] }>;
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
  personal_skill_vector_score?: number;
  personal_skill_vector_explanation?: string;
  history_id?: string | null;
  tailored_resume_id?: string | null;
  [k: string]: any;
};

const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const DEFAULT_RESUME_SOURCE = "default";
const TAILORED_RESUME_COMING_SOON = true;
const snapshotResumeSourceValue = (snapshotId: string) => `snapshot:${snapshotId}`;
const evidenceResumeSourceValue = (evidenceId: string) => `evidence:${evidenceId}`;

function parseResumeSourceValue(value: string): { kind: "default" | "snapshot" | "evidence"; id: string | null } {
  if (!value || value === DEFAULT_RESUME_SOURCE) {
    return { kind: "default", id: null };
  }
  if (value.startsWith("snapshot:")) {
    return { kind: "snapshot", id: value.slice("snapshot:".length) || null };
  }
  if (value.startsWith("evidence:")) {
    return { kind: "evidence", id: value.slice("evidence:".length) || null };
  }
  return { kind: "default", id: null };
}

const REWARD_ACTIONS: Record<string, { href: string; label: string }> = {
  evidence_saved: { href: "/app/evidence", label: "Add evidence" },
  profile_skills_confirmed: { href: "/app/skills", label: "Confirm skills" },
  resume_snapshots_uploaded: { href: "/app/evidence?add=1&type=resume", label: "Add resume evidence" },
  job_matches_run: { href: "/app/jobs", label: "Run match" },
  tailored_resumes_generated: { href: "/app/jobs", label: "Generate resume" },
};

function gapTypeLabel(value: string): string {
  switch (String(value || "").toLowerCase()) {
    case "required":
      return "Important";
    case "preferred":
      return "Helpful";
    case "adjacent":
      return "Close match";
    default:
      return "Other";
  }
}

function severityLabel(value: string): string {
  switch (String(value || "").toLowerCase()) {
    case "high":
      return "Needs attention";
    default:
      return "Worth improving";
  }
}

function getBreakdownTooltipLines(
  entry: NonNullable<MatchResult["score_breakdown"]>[number],
  normalized: NormalizedAnalysis,
): string[] {
  const label = String(entry?.label ?? "").toLowerCase();
  const lines: string[] = [];
  const includedItems = asArray<BreakdownIncludedItem>(entry?.included_items)
    .map((item) => [String(item?.label ?? "").trim(), String(item?.detail ?? "").trim()].filter(Boolean).join(": "))
    .filter(Boolean);

  if (includedItems.length > 0) {
    lines.push(...includedItems.slice(0, 5));
  }

  if (label.includes("required")) {
    lines.push(`Important skills matched: ${normalized.requiredMatchedCount}/${normalized.requiredSkillCount || normalized.extractedSkillCount || 0}`);
    lines.push(`This part checks the main skills the job says you need.`);
    if (normalized.matchedSkills.length) {
      lines.push(`Matched skills: ${normalized.matchedSkills.slice(0, 5).join(", ")}`);
    }
  } else if (label.includes("nice") || label.includes("preferred")) {
    lines.push(`Helpful skills matched: ${normalized.preferredMatchedCount}/${normalized.preferredSkillCount || 0}`);
    lines.push(`Overall job skills matched: ${normalized.matchedSkillCount}/${normalized.extractedSkillCount || 0}`);
    if (normalized.matchedSkills.length) {
      lines.push(`Included skills: ${normalized.matchedSkills.slice(0, 5).join(", ")}`);
    }
  } else if (label.includes("proof")) {
    lines.push(`Matched skills with proof: ${normalized.evidenceAlignedCount}/${normalized.matchedSkillCount || 0}`);
    lines.push(`Matched skills without proof: ${normalized.evidenceGapCount}`);
    const evidenceNames = normalized.retrievedContext
      .slice(0, 4)
      .map((item) => item.evidence_name || item.title)
      .filter(Boolean);
    if (evidenceNames.length) {
      lines.push(`Evidence used: ${evidenceNames.join(", ")}`);
    }
  } else if (label.includes("keyword")) {
    lines.push(`Important words found in your work: ${normalized.keywordOverlapTerms.length ? normalized.keywordOverlapTerms.slice(0, 6).join(", ") : "None"}`);
    lines.push(`This counts the job words that also appear in your evidence or resume text.`);
  } else if (label.includes("semantic")) {
    lines.push(`This checks whether your saved work sounds like the job, even if the wording is different.`);
    if (normalized.retrievedContext.length) {
      const evidenceNames = normalized.retrievedContext
        .slice(0, 3)
        .map((item) => item.evidence_name || item.title)
        .filter(Boolean);
      if (evidenceNames.length) {
        lines.push(`Compared against: ${evidenceNames.join(", ")}`);
      }
    }
  } else if (label.includes("overall")) {
    lines.push(`Blends skills, proof, keywords, and similarity checks.`);
    lines.push(`Matched skills: ${normalized.matchedSkillCount}/${normalized.extractedSkillCount || 0}`);
    lines.push(`Proof-backed matches: ${normalized.evidenceAlignedCount}/${normalized.matchedSkillCount || 0}`);
  } else {
    lines.push(entry?.detail || "This score uses the information collected for the analysis.");
  }

  if (!lines.length) {
    lines.push("This score uses the information collected for the analysis.");
  }

  return lines.slice(0, 6);
}

type NormalizedAnalysis = {
  matchScore: number;
  confidenceLabel: string;
  analysisSummary: string;
  resumeSnapshotId: string | null;
  resumeEvidenceId: string | null;
  templateSource: string | null;
  ignoredSkills: string[];
  addedFromMissingSkills: Array<{ skill_id: string; skill_name: string }>;
  matchedSkillEntries: Array<{ skillId: string; skillName: string }>;
  missingSkillEntries: Array<{ skillId: string; skillName: string }>;
  matchedSkills: string[];
  missingSkills: string[];
  matchedSkillCount: number;
  missingSkillCount: number;
  strengthAreas: string[];
  relatedSkills: string[];
  retrievedContext: RetrievedContextItem[];
  gapReasoningSummary: string;
  gapInsights: GapInsightItem[];
  scoreBreakdown: Array<{ label?: string; score?: number; detail?: string; included_items?: BreakdownIncludedItem[] }>;
  nextSteps: string[];
  extractedSkillCount: number;
  confirmedSkillCount: number;
  requiredSkillCount: number;
  requiredMatchedCount: number;
  preferredSkillCount: number;
  preferredMatchedCount: number;
  evidenceAlignedCount: number;
  evidenceGapCount: number;
  keywordOverlapCount: number;
  keywordOverlapTerms: string[];
  keywordOverlapScore: number;
  semanticAlignmentScore: number;
  semanticAlignmentExplanation: string;
  personalSkillVectorScore: number;
  personalSkillVectorExplanation: string;
  historyId?: string | null;
  tailoredResumeId?: string | null;
};

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

function tailoredResumeFilename(jobTitle?: string, company?: string, extension = "docx") {
  const base = String(jobTitle || company || "tailored_resume")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || "tailored_resume"}.${extension}`;
}

function formatResumeTemplateLabel(snapshot: ResumeSnapshotListEntry) {
  const filename = String(snapshot.filename ?? "").trim();
  if (filename) return `Updated Resume from Evidence • ${filename}`;

  const sourceType = String(snapshot.source_type ?? "resume").trim().toLowerCase();
  const sourceLabel =
    sourceType === "pdf"
      ? "PDF Resume"
      : sourceType === "docx"
        ? "Word Resume"
      : sourceType === "paste"
        ? "Pasted Resume"
        : `${sourceType.charAt(0).toUpperCase()}${sourceType.slice(1)} Resume`;

  if (!snapshot.created_at) return `Updated Resume from Evidence • ${sourceLabel}`;

  return `Updated Resume from Evidence • ${sourceLabel} • ${new Date(snapshot.created_at).toLocaleDateString()}`;
}

function formatResumeEvidenceLabel(evidence: Evidence) {
  const title = String(evidence.title ?? "").trim();
  if (title) return `Resume Evidence • ${title}`;
  if (!evidence.created_at) return "Resume Evidence";
  return `Resume Evidence • ${new Date(evidence.created_at).toLocaleDateString()}`;
}

const tailoredResumeTemplates = [
  { value: "ats_v1", label: "ATS Classic", description: "Straightforward, recruiter-safe ordering with skills near the top." },
  { value: "professional_v1", label: "Professional", description: "Traditional summary-first layout for polished applications." },
  { value: "modern_v1", label: "Modern Impact", description: "Leans into impact and selected highlights before deeper detail." },
  { value: "project_focused_v1", label: "Project Forward", description: "Moves strong project work earlier for technical or portfolio-heavy roles." },
  { value: "experience_focused_v1", label: "Experience Forward", description: "Pushes work history up front when experience should lead the story." },
];

const uploadedResumeRewordTemplate = {
  value: "uploaded_resume_reword_v1",
  label: "Reword My Resume",
  description: "Keeps your uploaded resume section order and headings, while rewriting the bullets in place.",
};

export function Jobs() {
  const { recordActivity } = useActivity();
  const { activeHeaderTheme } = useHeaderTheme();
  const { preferences } = useAccountPreferences();
  const softPanelClass = getHeaderThemeSoftPanelClass(activeHeaderTheme, preferences.panelStyle, preferences.gradientMode);
  const [searchParams, setSearchParams] = useSearchParams();
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isJobDescriptionExpanded, setIsJobDescriptionExpanded] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MatchResult | null>(null);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);

  const [lastTailoredId, setLastTailoredId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<JobMatchHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [resumeSnapshots, setResumeSnapshots] = useState<ResumeSnapshotListEntry[]>([]);
  const [resumeEvidence, setResumeEvidence] = useState<Evidence[]>([]);
  const [selectedResumeTemplate, setSelectedResumeTemplate] = useState<string>(DEFAULT_RESUME_SOURCE);
  const [selectedResumeLayout, setSelectedResumeLayout] = useState<string>("ats_v1");
  const [restoringHistoryId, setRestoringHistoryId] = useState<string | null>(null);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [reanalyzingHistoryId, setReanalyzingHistoryId] = useState<string | null>(null);
  const [reanalyzingCurrent, setReanalyzingCurrent] = useState(false);
  const [addingMissingSkill, setAddingMissingSkill] = useState<string | null>(null);
  const [updatingIgnoredSkill, setUpdatingIgnoredSkill] = useState<string | null>(null);

  const normalized = useMemo<NormalizedAnalysis>(() => {
    const a = analysis || {};
    const scoreBreakdown = asArray<{ label?: string; score?: number; detail?: string; included_items?: BreakdownIncludedItem[] }>(
      a.score_breakdown ?? a.scoreBreakdown
    );
    const keywordOverlapBreakdown = scoreBreakdown.find(
      (item) => String(item?.label ?? "").toLowerCase() === "keyword overlap"
    );
    return {
      matchScore: Number(a.match_score ?? a.matchScore ?? 0) || 0,
      confidenceLabel: String(a.match_confidence_label ?? a.matchConfidenceLabel ?? "Early"),
      analysisSummary: String(a.analysis_summary ?? a.analysisSummary ?? ""),
      resumeSnapshotId: String(a.resume_snapshot_id ?? a.resumeSnapshotId ?? "").trim() || null,
      resumeEvidenceId: String(a.resume_evidence_id ?? a.resumeEvidenceId ?? "").trim() || null,
      templateSource: String(a.template_source ?? a.templateSource ?? "").trim() || null,
      ignoredSkills: asArray<string>(a.ignored_skill_names ?? a.ignoredSkills),
      addedFromMissingSkills: asArray<{ skill_id: string; skill_name: string }>(a.added_from_missing_skills ?? a.addedFromMissingSkills),
      matchedSkillEntries: asArray<string>(a.matched_skills ?? a.matchedSkills).map((name, index) => ({
        skillId: String(asArray<string>(a.matched_skill_ids ?? a.matchedSkillIds)[index] ?? "").trim(),
        skillName: String(name ?? "").trim(),
      })),
      missingSkillEntries: asArray<string>(a.missing_skills ?? a.missingSkills).map((name, index) => ({
        skillId: String(asArray<string>(a.missing_skill_ids ?? a.missingSkillIds)[index] ?? "").trim(),
        skillName: String(name ?? "").trim(),
      })),
      matchedSkills: asArray<string>(a.matched_skills ?? a.matchedSkills),
      missingSkills: asArray<string>(a.missing_skills ?? a.missingSkills),
      matchedSkillCount: Number(a.matched_skill_count ?? a.matchedSkillCount ?? asArray<string>(a.matched_skills ?? a.matchedSkills).length) || 0,
      missingSkillCount: Number(a.missing_skill_count ?? a.missingSkillCount ?? asArray<string>(a.missing_skills ?? a.missingSkills).length) || 0,
      strengthAreas: asArray<string>(a.strength_areas ?? a.strengthAreas),
      relatedSkills: asArray<string>(a.related_skills ?? a.relatedSkills),
      retrievedContext: asArray<RetrievedContextItem>(a.retrieved_context ?? a.retrievedContext),
      gapReasoningSummary: String(a.gap_reasoning_summary ?? a.gapReasoningSummary ?? ""),
      gapInsights: asArray<GapInsightItem>(a.gap_insights ?? a.gapInsights),
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
      personalSkillVectorScore: Number(a.personal_skill_vector_score ?? a.personalSkillVectorScore ?? 0) || 0,
      personalSkillVectorExplanation: String(a.personal_skill_vector_explanation ?? a.personalSkillVectorExplanation ?? ""),
      historyId: a.history_id ?? a.historyId ?? null,
      tailoredResumeId: a.tailored_resume_id ?? a.tailoredResumeId ?? null,
    };
  }, [analysis]);

  const availableResumeLayouts = useMemo(
    () =>
      parseResumeSourceValue(selectedResumeTemplate).kind !== "snapshot"
        ? tailoredResumeTemplates
        : [...tailoredResumeTemplates, uploadedResumeRewordTemplate],
    [selectedResumeTemplate]
  );
  const selectedResumeSource = useMemo(() => parseResumeSourceValue(selectedResumeTemplate), [selectedResumeTemplate]);
  const selectedResumePayload = useMemo(
    () => ({
      resume_snapshot_id: selectedResumeSource.kind === "snapshot" ? selectedResumeSource.id : null,
      resume_evidence_id: selectedResumeSource.kind === "evidence" ? selectedResumeSource.id : null,
    }),
    [selectedResumeSource]
  );
  const exportFormatLabel = "DOCX";

  const handleReset = () => {
    setJobDescription("");
    setIsJobDescriptionExpanded(false);
    setJobTitle("");
    setCompany("");
    setLocation("");
    setAnalysis(null);
    setLastTailoredId(null);
    setJobId(null);
    setSelectedResumeTemplate(DEFAULT_RESUME_SOURCE);
    setSelectedResumeLayout("ats_v1");
  };

  useEffect(() => {
    if (selectedResumeSource.kind === "default") return;
    if (selectedResumeSource.kind === "snapshot" && resumeSnapshots.some((snapshot) => snapshot.snapshot_id === selectedResumeSource.id)) return;
    if (selectedResumeSource.kind === "evidence" && resumeEvidence.some((item) => item.id === selectedResumeSource.id)) return;
    setSelectedResumeTemplate(DEFAULT_RESUME_SOURCE);
  }, [resumeEvidence, resumeSnapshots, selectedResumeSource]);

  useEffect(() => {
    if (selectedResumeSource.kind === "snapshot") return;
    if (selectedResumeLayout !== uploadedResumeRewordTemplate.value) return;
    setSelectedResumeLayout("ats_v1");
  }, [selectedResumeLayout, selectedResumeSource]);

  useEffect(() => {
    const resetToken = searchParams.get("new") ?? searchParams.get("_nav");
    if (!resetToken) return;

    handleReset();
    descriptionRef.current?.focus();
    descriptionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

    const next = new URLSearchParams(searchParams);
    next.delete("new");
    next.delete("_nav");
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
    const loadHistoryAndTemplates = async () => {
      setHistoryLoading(true);
      try {
        const entries = await api.listJobMatchHistory(8);
        if (active) setHistory(entries);
      } catch (error) {
        console.error("Failed to load job match history:", error);
      } finally {
        if (active) setHistoryLoading(false);
      }

      try {
        const [snapshots, evidence] = await Promise.all([
          api.listResumeSnapshots(),
          api.listEvidence({ origin: "user" }),
        ]);
        if (active) {
          setResumeSnapshots(snapshots);
          setResumeEvidence(evidence.filter((item) => String(item.type ?? "").trim().toLowerCase() === "resume"));
        }
      } catch (error) {
        console.error("Failed to load resume snapshots:", error);
      }
    };
    loadHistoryAndTemplates();
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
      const match = await api.matchJob({
        job_id: String(jid),
        ...selectedResumePayload,
      });
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
        ...selectedResumePayload,
        ignored_skill_names: normalized.ignoredSkills,
        template: selectedResumeLayout,
      });
      const previewId = String((preview as any)?.id ?? (preview as any)?.tailored_id ?? (preview as any)?.tailoredId ?? "").trim();
      if (!previewId) {
        throw new Error("Tailored resume was created without an export id");
      }
      setLastTailoredId(previewId);
      setAnalysis((current) => (current ? { ...current, tailored_resume_id: previewId } : current));
      const blob = await api.downloadTailoredDocx(previewId);
      downloadBlob(blob, tailoredResumeFilename(jobTitle, company, "docx"));
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
        id: `jobs:export:docx:${previewId}`,
        type: "resume",
        action: "exported",
        name: `${jobTitle || company || "Tailored resume"} (${exportFormatLabel})`,
      });
      toast.success(`Tailored resume ${exportFormatLabel} downloaded`);
    } catch (error: any) {
      console.error("Failed to generate resume:", error);
      toast.error(error?.message || `Failed to generate tailored resume ${exportFormatLabel}`);
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
    const currentHistoryId = String(normalized.historyId ?? "").trim() || undefined;

    setUpdatingIgnoredSkill(normalizedName);
    try {
      const match = await api.matchJob({
        job_id: jobId,
        ...selectedResumePayload,
        history_id: currentHistoryId,
        ignored_skill_names: nextIgnored,
        added_from_missing_skills: normalized.addedFromMissingSkills,
        persist_history: false,
      });
      setAnalysis((current) => ({
        ...(current ?? {}),
        ...(match as MatchResult),
        history_id: currentHistoryId ?? current?.history_id ?? (match as any)?.history_id ?? null,
        tailored_resume_id: null,
      }));
      setLastTailoredId(null);
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
      const restoredResumeEvidenceId = String((detail.analysis as any)?.resume_evidence_id ?? "").trim();
      const restoredResumeSnapshotId = String((detail.analysis as any)?.resume_snapshot_id ?? "").trim();
      setSelectedResumeTemplate(
        restoredResumeEvidenceId
          ? evidenceResumeSourceValue(restoredResumeEvidenceId)
          : restoredResumeSnapshotId
            ? snapshotResumeSourceValue(restoredResumeSnapshotId)
            : DEFAULT_RESUME_SOURCE
      );
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
    setReanalyzingHistoryId(entry.id);
    try {
      const match = await api.reanalyzeJobMatchHistory(entry.id);
      setAnalysis(match as MatchResult);
      setJobId(String((match as any)?.job_id ?? entry.job_id ?? "").trim() || null);
      setJobTitle(String(entry.title ?? "").trim());
      setCompany(String(entry.company ?? "").trim());
      setLocation(String(entry.location ?? "").trim());
      setLastTailoredId(null);
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

  const handleReanalyzeCurrent = async () => {
    const currentHistoryId = String(normalized.historyId ?? "").trim();
    if (!currentHistoryId) {
      toast.error("Restore or save a job analysis before reanalyzing it");
      return;
    }

    setReanalyzingCurrent(true);
    try {
      const match = await api.reanalyzeJobMatchHistory(currentHistoryId);
      setAnalysis(match as MatchResult);
      setJobId(String((match as any)?.job_id ?? jobId ?? "").trim() || null);
      setLastTailoredId(null);
      try {
        await refreshHistory();
      } catch (historyError) {
        console.error("Failed to refresh job match history:", historyError);
      }
      recordActivity({
        id: `jobs:reanalyze-current:${currentHistoryId}`,
        type: "jobs",
        action: "reanalyzed",
        name: jobTitle || company || "Current job match",
      });
      toast.success("Job match score updated");
    } catch (error: any) {
      console.error("Failed to reanalyze current job match:", error);
      toast.error(error?.message || "Failed to update the current job match");
    } finally {
      setReanalyzingCurrent(false);
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
      const currentHistoryId = String(normalized.historyId ?? "").trim() || undefined;
      const currentAdded = asArray<{ skill_id: string; skill_name: string }>(analysis?.added_from_missing_skills ?? []);
      const nextAdded = [
        ...currentAdded.filter(
          (entry) => String(entry?.skill_id ?? "").trim() !== skillId && String(entry?.skill_name ?? "").trim().toLowerCase() !== normalizedName.toLowerCase()
        ),
        { skill_id: skillId, skill_name: normalizedName },
      ];
      const match = await api.matchJob({
        job_id: String(jobId ?? "").trim(),
        ...selectedResumePayload,
        history_id: currentHistoryId,
        ignored_skill_names: normalized.ignoredSkills.filter((value) => value !== normalizedName),
        added_from_missing_skills: nextAdded,
        persist_history: false,
      });
      setAnalysis((current) => ({
        ...(current ?? {}),
        ...(match as MatchResult),
        history_id: currentHistoryId ?? current?.history_id ?? (match as any)?.history_id ?? null,
        tailored_resume_id: null,
      }));
      setLastTailoredId(null);
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

  const handleRemoveMatchedSkill = async (skillName: string, skillId?: string) => {
    const normalizedName = String(skillName || "").trim();
    const normalizedSkillId = String(skillId || "").trim();
    if (!normalizedName) return;

    if (!normalizedSkillId) {
      toast.error("This matched skill is missing its skill id");
      return;
    }

    setUpdatingIgnoredSkill(normalizedName);
    try {
      await api.unconfirmSkill(null, normalizedSkillId);
      const currentHistoryId = String(normalized.historyId ?? "").trim() || undefined;
      const nextAdded = asArray<{ skill_id: string; skill_name: string }>(analysis?.added_from_missing_skills ?? []).filter((entry) => {
        const entryId = String(entry?.skill_id ?? "").trim();
        const entryName = String(entry?.skill_name ?? "").trim().toLowerCase();
        return entryId !== normalizedSkillId && entryName !== normalizedName.toLowerCase();
      });
      const match = await api.matchJob({
        job_id: String(jobId ?? "").trim(),
        ...selectedResumePayload,
        history_id: currentHistoryId,
        ignored_skill_names: normalized.ignoredSkills.filter((value) => value !== normalizedName),
        added_from_missing_skills: nextAdded,
        persist_history: false,
      });
      setAnalysis((current) => ({
        ...(current ?? {}),
        ...(match as MatchResult),
        history_id: currentHistoryId ?? current?.history_id ?? (match as any)?.history_id ?? null,
        tailored_resume_id: null,
      }));
      setLastTailoredId(null);
      recordActivity({
        id: `jobs:missing-skill:remove:${normalizedSkillId}`,
        type: "skills",
        action: "unconfirmed",
        name: normalizedName,
      });
      toast.success(`${normalizedName} removed from your confirmed skills`);
    } catch (error: any) {
      console.error("Failed to remove matched skill:", error);
      toast.error(error?.message || "Failed to remove matched skill");
    } finally {
      setUpdatingIgnoredSkill(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-[#0D9488]";
    return "text-orange-600";
  };

  useEffect(() => {
    api.getRewardsSummary().then(setRewards).catch(() => setRewards(null));
  }, [history.length, analysis?.tailored_resume_id]);

  if (!analysis) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
          <div className="px-6 py-6 md:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  Job Match Workspace
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Run a grounded job-fit analysis</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Paste a job post to see how well your saved skills and proof match it, what is missing, and what to fix next.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:w-[20rem] lg:w-[22rem]">
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">
                    Saved Runs
                  </p>
                  <p className="mt-2 break-words text-2xl font-semibold text-slate-900 dark:text-slate-100">{history.length}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">
                    Templates
                  </p>
                  <p className="mt-2 break-words text-2xl font-semibold text-slate-900 dark:text-slate-100">{resumeSnapshots.length + resumeEvidence.length + 1}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {preferences.showNextAchievementCard && rewards?.nextAchievement ? (
          <Card className="border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Next achievement</div>
                <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{rewards.nextAchievement.title}</div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{rewards.nextAchievement.description}</p>
                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {rewards.nextAchievement.current_value}/{rewards.nextAchievement.target_value} toward unlock
                </p>
                <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-2 rounded-full ${activeHeaderTheme.barClass}`}
                    style={{ width: `${Math.max(6, rewards.nextAchievement.progress_pct)}%` }}
                  />
                </div>
              </div>
              {REWARD_ACTIONS[rewards.nextAchievement.counter_key] ? (
                <Button asChild className={activeHeaderTheme.buttonClass}>
                  <Link to={REWARD_ACTIONS[rewards.nextAchievement.counter_key].href}>
                    {REWARD_ACTIONS[rewards.nextAchievement.counter_key].label}
                  </Link>
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className={`rounded-2xl p-2.5 ${softPanelClass}`}>
                <Sparkles className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Start a new analysis</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">Capture the role details and full posting before running the model.</p>
              </div>
            </div>
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
                rows={9}
                className={`${isJobDescriptionExpanded ? "h-[30rem]" : "h-64"} resize-none overflow-y-auto font-mono text-sm`}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500 dark:text-slate-400">Include requirements, qualifications, and responsibilities for best results.</p>
                {jobDescription.trim().length > 600 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setIsJobDescriptionExpanded((current) => !current)}
                  >
                    {isJobDescriptionExpanded ? "Show less" : "Load more"}
                  </Button>
                ) : null}
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={analyzing || !jobDescription.trim()}
              className={`h-12 w-full text-base ${activeHeaderTheme.buttonClass}`}
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

        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 mb-4">
            <div className={`rounded-2xl p-2.5 ${softPanelClass}`}>
              <History className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Last Analyzed Jobs</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">Restore, rerun, or export from recent job-match sessions.</p>
            </div>
          </div>
          {historyLoading ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">Loading previous analyses...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">No prior analyses yet.</p>
          ) : (
            <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-2">
              {history.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-950/60">
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
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-6 py-6 md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                Active Analysis
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{jobTitle || company || "Job Match"}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Detailed score, skill gaps, and plain-language match feedback in the same visual system as the rest of SkillBridge.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleReanalyzeCurrent} disabled={reanalyzingCurrent || !jobId}>
                <RotateCw className={`mr-2 h-4 w-4 ${reanalyzingCurrent ? "animate-spin" : ""}`} />
                {reanalyzingCurrent ? "Updating..." : "Reanalyze"}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                New Analysis
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Match Score</p>
          <p className={`mt-2 text-2xl font-semibold ${getScoreColor(normalized.matchScore)}`}>{normalized.matchScore}%</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Confidence</p>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{normalized.confidenceLabel} Fit</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Matched Skills</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{normalized.matchedSkillCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Missing Skills</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{normalized.missingSkillCount}</p>
        </div>
      </div>

      <Card className="border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-wrap gap-2">
          {[
            ["#job-summary", "Summary"],
            ["#job-skills", "Skills"],
            ["#job-reasoning", "Reasoning"],
            ["#job-resume", "Resume"],
            ["#job-history", "History"],
          ].map(([href, label]) => (
            <Button key={href} asChild variant="outline" size="sm" className="h-8 rounded-full border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/70">
              <a href={href}>{label}</a>
            </Button>
          ))}
        </div>
      </Card>

      <Card id="job-summary" className="scroll-mt-24 border-slate-200 p-8 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:items-center">
          <div className={`flex flex-col items-center rounded-2xl p-6 text-center ${softPanelClass}`}>
            <span className={`text-5xl font-bold ${getScoreColor(normalized.matchScore)}`}>{normalized.matchScore}%</span>
            <span className="mt-1 text-sm text-gray-600 dark:text-slate-300">Match Score</span>
            <Badge className="mt-4 border-gray-200 bg-white text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{normalized.confidenceLabel} Fit</Badge>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">{jobTitle || "(job)"}</h2>
            <p className="text-gray-600 dark:text-slate-300">{company || ""}</p>
            {location ? <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{location}</p> : null}
            <p className="mt-4 text-sm leading-6 text-gray-700 dark:text-slate-200">
              {normalized.analysisSummary || "This score shows how well your saved skills, proof, and work history match this job post."}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Extracted Job Skills</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{normalized.extractedSkillCount}</p>
        </Card>
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Required Skills Covered</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">
            {normalized.requiredMatchedCount}/{normalized.requiredSkillCount || normalized.extractedSkillCount || 0}
          </p>
        </Card>
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Matched Job Skills</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{normalized.matchedSkillCount}</p>
        </Card>
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Missing Job Skills</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{normalized.missingSkillCount}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">How close your work feels to the job</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{normalized.semanticAlignmentScore}%</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
            {normalized.semanticAlignmentExplanation || "This checks whether your saved work sounds similar to the job, even when the exact words are different."}
          </p>
        </Card>
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Overall profile match</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{normalized.personalSkillVectorScore}%</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
            {normalized.personalSkillVectorExplanation || "This compares the whole job post to your full profile to see how closely they match overall."}
          </p>
        </Card>
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm text-gray-500 dark:text-slate-400">Coverage Snapshot</p>
          <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-slate-200">
            <p>Matched job skills: {normalized.matchedSkillCount} of {normalized.extractedSkillCount}</p>
            <p>Missing job skills: {normalized.missingSkillCount} of {normalized.extractedSkillCount}</p>
            <p>Required skills matched: {normalized.requiredMatchedCount} of {normalized.requiredSkillCount}</p>
            <p>Preferred skills matched: {normalized.preferredMatchedCount} of {normalized.preferredSkillCount}</p>
            <p>Matched skills with proof: {normalized.evidenceAlignedCount} of {normalized.matchedSkillCount}</p>
            <p>Important job words found in your work: {normalized.keywordOverlapScore}%</p>
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

      <Card id="job-reasoning" className="p-6 scroll-mt-24 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Score Breakdown</h3>
          <p className="text-sm text-gray-600 dark:text-slate-300">The score looks at important skills, proof behind those skills, and how closely your work matches the job post.</p>
        </div>
        <div className="space-y-4">
          {normalized.scoreBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">No breakdown available.</p>
          ) : (
            normalized.scoreBreakdown.map((item) => {
              const score = Number(item?.score ?? 0) || 0;
              const tooltipLines = getBreakdownTooltipLines(item, normalized);
              return (
                <Tooltip key={item?.label || score}>
                  <TooltipTrigger asChild>
                    <div className="group space-y-2 rounded-xl border border-transparent p-3 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-950/40">
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
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-md border border-slate-200 bg-white text-slate-700 shadow-xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        What was counted
                      </p>
                      {tooltipLines.map((line) => (
                        <p key={`${item?.label || "metric"}:${line}`} className="text-sm leading-5">
                          {line}
                        </p>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })
          )}
        </div>
      </Card>

      <div id="job-skills" className="grid grid-cols-1 md:grid-cols-3 gap-6 scroll-mt-24">
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Matched Skills</h3>
          </div>
          <div className="max-h-[18rem] overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {normalized.matchedSkills.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-slate-400">None returned</span>
            ) : (
              normalized.matchedSkillEntries.map((entry) => (
                <span
                  key={`${entry.skillId || entry.skillName}:matched`}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-200"
                >
                  <span className="min-w-0 break-words whitespace-normal">{entry.skillName}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMatchedSkill(entry.skillName, entry.skillId)}
                    disabled={updatingIgnoredSkill === entry.skillName}
                    className="rounded-full p-0.5 text-current transition hover:bg-black/10 disabled:opacity-50 dark:hover:bg-white/10"
                    aria-label={`Remove ${entry.skillName} from this analysis`}
                    title="Remove from this analysis"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))
            )}
          </div>
          </div>
        </Card>

        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Missing Skills</h3>
          </div>
          <div className="max-h-[18rem] overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {normalized.missingSkills.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-slate-400">None returned</span>
            ) : (
              normalized.missingSkills.map((s) => (
                <span
                  key={s}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-orange-300 bg-white px-1.5 py-1 text-sm font-medium text-orange-700 dark:border-orange-900/60 dark:bg-slate-900 dark:text-orange-200"
                >
                  <Button
                    variant="ghost"
                    onClick={() => handleAddMissingSkill(s)}
                    disabled={addingMissingSkill === s}
                    className="h-auto max-w-full rounded-full px-1.5 py-0 text-sm font-medium text-orange-700 hover:bg-orange-50 dark:text-orange-200 dark:hover:bg-orange-950/40"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    <span className="break-words whitespace-normal text-left">{addingMissingSkill === s ? "Adding..." : s}</span>
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
          </div>
        </Card>

        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Strength Areas</h3>
          </div>
          <div className="max-h-[18rem] overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {normalized.strengthAreas.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-slate-400">None returned</span>
            ) : (
              normalized.strengthAreas.map((s) => (
                <Badge key={s} className="max-w-full whitespace-normal break-words border-blue-200 bg-blue-50 text-left text-[#1E3A8A] dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-200">
                  {s}
                </Badge>
              ))
            )}
          </div>
          </div>
        </Card>
      </div>

      {normalized.ignoredSkills.length > 0 ? (
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
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
            <Sparkles className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
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
            <AlertCircle className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
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
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Why the score is lower</h3>
          </div>
        <p className="mb-4 text-sm text-gray-600 dark:text-slate-300">
          {normalized.gapReasoningSummary || "The system did not return a clear reason for the missing skills in this result."}
        </p>
        {normalized.gapInsights.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">No detailed missing-skill notes were returned.</p>
        ) : (
          <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
            {normalized.gapInsights.map((insight) => (
              <div key={`${insight.skill_id}:${insight.gap_type}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{insight.skill_name}</span>
                  <Badge className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {gapTypeLabel(insight.gap_type)}
                  </Badge>
                  <Badge
                    className={
                      insight.severity === "high"
                        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                    }
                  >
                    {severityLabel(insight.severity)}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{insight.reason}</p>
                <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">{insight.recommended_action}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card id="job-resume" className="relative scroll-mt-24 overflow-hidden border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className={TAILORED_RESUME_COMING_SOON ? "pointer-events-none select-none blur-[5px] opacity-55" : ""} aria-hidden={TAILORED_RESUME_COMING_SOON}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Tailored Resume</h3>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                Choose your resume source, then pick the resume style below it. Uploaded resumes can also be reworded while keeping their structure intact.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="min-w-[260px] space-y-3">
                <Select value={selectedResumeTemplate} onValueChange={setSelectedResumeTemplate}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose resume source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_RESUME_SOURCE}>Default Template</SelectItem>
                    {resumeSnapshots.map((snapshot) => (
                      <SelectItem key={snapshot.snapshot_id} value={snapshotResumeSourceValue(snapshot.snapshot_id)}>
                        {formatResumeTemplateLabel(snapshot)}
                      </SelectItem>
                    ))}
                    {resumeEvidence.map((evidence) => (
                      <SelectItem key={evidence.id} value={evidenceResumeSourceValue(evidence.id)}>
                        {formatResumeEvidenceLabel(evidence)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedResumeLayout} onValueChange={setSelectedResumeLayout}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose resume style" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableResumeLayouts.map((template) => (
                      <SelectItem key={template.value} value={template.value}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleGenerateResume}
                disabled={TAILORED_RESUME_COMING_SOON || generating || !jobId}
                className={activeHeaderTheme.buttonClass}
              >
                <Download className="mr-2 h-4 w-4" />
                {generating ? `Generating ${exportFormatLabel}...` : `Generate ${exportFormatLabel}`}
              </Button>
            </div>
          </div>

          <div className={`mt-4 rounded-2xl border p-4 ${softPanelClass}`}>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {availableResumeLayouts.find((template) => template.value === selectedResumeLayout)?.label ?? "Resume style"}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
              {availableResumeLayouts.find((template) => template.value === selectedResumeLayout)?.description ??
                "Choose the layout that best fits the role you are targeting."}
            </p>
          </div>

          {lastTailoredId ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200">
              Tailored resume generated and downloaded. Resume id: <span className="font-mono">{lastTailoredId}</span>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500 dark:text-slate-400">
              {resumeSnapshots.length > 0 || resumeEvidence.length > 0
                ? "Pick a resume source and layout. Tailored resumes now download as DOCX first to preserve formatting, while resume evidence titles are rewritten into resume-friendly content."
                : "Pick a layout, then generate a DOCX version from the default resume structure."}
            </div>
          )}
        </div>

        {TAILORED_RESUME_COMING_SOON ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/30 px-6 backdrop-blur-[1px] dark:bg-slate-950/35">
            <div className="max-w-md rounded-3xl border border-slate-200 bg-white/88 px-6 py-5 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900/88">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Coming Soon</div>
              <h4 className="mt-3 text-xl font-semibold text-slate-900 dark:text-slate-100">Tailored resumes are temporarily disabled</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                This section is being reworked. You can still run job matches and review the score, skill gaps, and supporting proof while the resume tools are offline.
              </p>
            </div>
          </div>
        ) : null}
      </Card>

      <Card id="job-history" className="scroll-mt-24 border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Saved Job Match History</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300">Compare recent job analyses and see how match quality changes across postings.</p>
          </div>
        </div>

        <div className="mt-4 grid max-h-[28rem] grid-cols-1 gap-4 overflow-y-auto pr-1 lg:grid-cols-2">
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
