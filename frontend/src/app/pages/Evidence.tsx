import { useEffect, useMemo, useState } from "react";
import { api, type Evidence, type EvidenceAnalysis } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Plus, ExternalLink, FileText, Upload, ScanSearch, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router";

const EVIDENCE_TYPES = [
  { value: "project", label: "Project" },
  { value: "paper", label: "Paper" },
  { value: "resume", label: "Resume" },
  { value: "cert", label: "Certification" },
  { value: "other", label: "Other" },
] as const;

type AnalysisSelectionMap = Record<string, string[]>;

function errMsg(error: any) {
  return String(error?.message || error || "Unknown error");
}

export function Evidence() {
  const { user } = useAuth();
  const { recordActivity } = useActivity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Evidence[]>([]);
  const [skillNameById, setSkillNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const [draft, setDraft] = useState({
    id: "",
    title: "",
    type: "project",
    text: "",
    url: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [analysisItems, setAnalysisItems] = useState<EvidenceAnalysis[]>([]);
  const [selectedSkillIdsByAnalysis, setSelectedSkillIdsByAnalysis] = useState<AnalysisSelectionMap>({});

  const loadEvidence = async () => {
    if (!user?.id) {
      setItems([]);
      return;
    }
    const rows = await api.listEvidence({ user_id: user.id, origin: "user" });
    setItems(Array.isArray(rows) ? rows : []);
  };

  const loadSkillNames = async () => {
    const skills = await api.listSkills();
    const next: Record<string, string> = {};
    for (const skill of skills) {
      const id = String(skill?.id ?? "").trim();
      const name = String(skill?.name ?? "").trim();
      if (!id || !name) continue;
      next[id] = name;
    }
    setSkillNameById(next);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([loadEvidence(), loadSkillNames()]);
      } catch (error) {
        console.error("Failed to fetch evidence:", error);
        toast.error("Failed to load evidence");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setIsAddOpen(true);
    }
  }, [searchParams]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const title = (item.title || "").toLowerCase();
      const text = (item.text_excerpt || item.description || "").toLowerCase();
      const source = (item.source || item.url || "").toLowerCase();
      return title.includes(term) || text.includes(term) || source.includes(term);
    });
  }, [items, searchTerm]);

  const resetDraft = () => {
    setDraft({ id: "", title: "", type: "project", text: "", url: "" });
    setFiles([]);
    setAnalysisItems([]);
    setSelectedSkillIdsByAnalysis({});
  };

  const openEditDialog = (item: Evidence) => {
    const analysisId = `analysis:existing:${item.id}`;
    setDraft({
      id: item.id,
      title: item.title || "",
      type: item.type || "project",
      text: item.text_excerpt || item.description || "",
      url: item.source && /^https?:\/\//i.test(item.source) ? item.source : "",
    });
    setFiles([]);
    setAnalysisItems([
      {
        analysis_id: analysisId,
        title: item.title || "",
        type: item.type || "project",
        source: item.source || "manual-entry",
        text_excerpt: item.text_excerpt || item.description || "",
        filename: null,
        extracted_skills: (item.skill_ids || []).map((skillId) => ({
          skill_id: skillId,
          skill_name: skillNameById[skillId] || skillId,
          is_new: false,
        })),
      },
    ]);
    setSelectedSkillIdsByAnalysis({ [analysisId]: item.skill_ids || [] });
    setIsAddOpen(true);
  };

  const handleAnalyze = async () => {
    if (!draft.text.trim() && files.length === 0) {
      toast.error("Add evidence text or upload one or more PDF/DOCX/TXT files first");
      return;
    }

    try {
      setAnalyzing(true);
      const result = await api.analyzeEvidence({
        title: draft.title.trim() || undefined,
        type: draft.type,
        text: draft.text.trim() || undefined,
        url: draft.url.trim() || undefined,
        files,
      });
      const nextItems = result.items || [];
      setAnalysisItems(nextItems);
      setSelectedSkillIdsByAnalysis(
        Object.fromEntries(nextItems.map((item) => [item.analysis_id, item.extracted_skills.map((skill) => skill.skill_id)]))
      );
      if (nextItems.length === 1) {
        setDraft((prev) => ({ ...prev, title: nextItems[0].title || prev.title }));
      }
      recordActivity({
        id: `evidence:analyze:${draft.id || Date.now()}`,
        type: "evidence",
        action: "analyzed",
        name: nextItems.length > 1 ? `${nextItems.length} evidence files` : nextItems[0]?.title || "Evidence",
      });
      toast.success("Evidence analyzed");
    } catch (error) {
      console.error("Failed to analyze evidence:", error);
      toast.error(errMsg(error));
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSkill = (analysisId: string, skillId: string, checked: boolean) => {
    setSelectedSkillIdsByAnalysis((prev) => {
      const next = new Set(prev[analysisId] || []);
      if (checked) next.add(skillId);
      else next.delete(skillId);
      return { ...prev, [analysisId]: Array.from(next) };
    });
  };

  const updateAnalysisItem = (analysisId: string, updates: Partial<EvidenceAnalysis>) => {
    setAnalysisItems((prev) =>
      prev.map((item) => (item.analysis_id === analysisId ? { ...item, ...updates } : item))
    );
  };

  const ensureSkillId = async (skill: EvidenceAnalysis["extracted_skills"][number]) => {
    if (!String(skill.skill_id || "").startsWith("candidate:")) {
      return skill.skill_id;
    }
    const existing = await api.listSkills({ q: skill.skill_name, limit: 50 });
    const exactMatch = existing.find(
      (entry) => entry.name?.trim().toLowerCase() === skill.skill_name.trim().toLowerCase()
    );
    if (exactMatch?.id) {
      return exactMatch.id;
    }
    try {
      const created = await api.createSkill({
        name: skill.skill_name,
        category: skill.category || "General",
      });
      return created.id;
    } catch (error) {
      const existing = await api.listSkills({ q: skill.skill_name, limit: 50 });
      const match = existing.find((entry) => entry.name?.trim().toLowerCase() === skill.skill_name.trim().toLowerCase());
      if (match?.id) {
        return match.id;
      }
      throw error;
    }
  };

  const handleSave = async () => {
    if (analysisItems.length === 0) {
      toast.error("Analyze the evidence before saving");
      return;
    }

    try {
      setSaving(true);
      const savedItems: Evidence[] = [];
      const confirmedSkillIds = new Set<string>();

      for (const analysis of analysisItems) {
        const selectedIds = selectedSkillIdsByAnalysis[analysis.analysis_id] || [];
        const selectedSkills = analysis.extracted_skills.filter((skill) => selectedIds.includes(skill.skill_id));
        const resolvedSkillIds: string[] = [];
        for (const skill of selectedSkills) {
          const actualId = await ensureSkillId(skill);
          resolvedSkillIds.push(actualId);
          confirmedSkillIds.add(actualId);
        }

        const payload = {
          user_id: user?.id,
          title: analysis.title,
          type: analysis.type,
          source: analysis.source,
          text_excerpt: analysis.text_excerpt,
          skill_ids: resolvedSkillIds,
          origin: "user" as const,
        };

        const saved = draft.id
          ? await api.updateEvidence(draft.id, {
              title: payload.title,
              type: payload.type,
              source: payload.source,
              text_excerpt: payload.text_excerpt,
              skill_ids: payload.skill_ids,
            })
          : await api.createEvidence(payload);
        savedItems.push(saved);
        recordActivity({
          id: `evidence:${saved.id}`,
          type: "evidence",
          action: draft.id ? "updated" : "added",
          name: saved.title,
        });

        if (draft.id) {
          break;
        }
      }

      if (confirmedSkillIds.size > 0) {
        await api.confirmProfileSkills(Array.from(confirmedSkillIds));
        recordActivity({
          id: `skills:evidence:${Date.now()}:${confirmedSkillIds.size}`,
          type: "skills",
          action: "confirmed",
          name: `${confirmedSkillIds.size} skill${confirmedSkillIds.size === 1 ? "" : "s"} from evidence`,
        });
      }

      setItems((prev) => {
        if (draft.id && savedItems[0]) {
          return prev.map((item) => (item.id === savedItems[0].id ? savedItems[0] : item));
        }
        return [...savedItems, ...prev];
      });
      setIsAddOpen(false);
      resetDraft();
      toast.success(draft.id ? "Evidence updated" : `${savedItems.length} evidence item${savedItems.length === 1 ? "" : "s"} saved`);
    } catch (error) {
      console.error("Failed to save evidence:", error);
      toast.error(errMsg(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Evidence) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try {
      setDeletingId(item.id);
      const result = await api.deleteEvidence(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      recordActivity({
        id: `evidence:delete:${item.id}`,
        type: "evidence",
        action: "deleted",
        name: item.title,
      });
      if ((result.removed_skill_ids || []).length) {
        recordActivity({
          id: `skills:evidence-delete:${item.id}`,
          type: "skills",
          action: "removed",
          name: `${result.removed_skill_ids?.length || 0} skill${(result.removed_skill_ids?.length || 0) === 1 ? "" : "s"} removed with evidence`,
        });
      }
      toast.success("Evidence deleted");
    } catch (error) {
      console.error("Failed to delete evidence:", error);
      toast.error(errMsg(error));
    } finally {
      setDeletingId("");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading evidence...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evidence</h1>
          <p className="text-sm text-gray-600">Only evidence you explicitly add from text or uploaded files appears here.</p>
        </div>

        <div className="flex gap-3">
          <Input
            placeholder="Search your evidence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-72"
          />

          <Dialog
            open={isAddOpen}
            onOpenChange={(open) => {
              setIsAddOpen(open);
              if (!open) {
                resetDraft();
                if (searchParams.get("add") === "1") {
                  const next = new URLSearchParams(searchParams);
                  next.delete("add");
                  setSearchParams(next, { replace: true });
                }
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90">
                <Plus className="mr-2 h-4 w-4" />
                Add Evidence
              </Button>
            </DialogTrigger>

            <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
              <DialogHeader className="border-b px-6 py-5">
                <DialogTitle>{draft.id ? "Edit Evidence" : "Add Evidence"}</DialogTitle>
                <DialogDescription>
                  Paste text or upload one or more files. SkillBridge will extract likely skills, including AI-inferred new skill candidates, then you decide what to save.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="evidence-title">Title</Label>
                    <Input
                      id="evidence-title"
                      value={draft.title}
                      onChange={(e) => {
                        setDraft((prev) => ({ ...prev, title: e.target.value }));
                        setAnalysisItems([]);
                      }}
                      placeholder="e.g., Research Assistant Project Summary"
                    />
                  </div>

                  <div>
                    <Label htmlFor="evidence-type">Type</Label>
                    <Select
                      value={draft.type}
                      onValueChange={(value) => {
                        setDraft((prev) => ({ ...prev, type: value }));
                        setAnalysisItems([]);
                      }}
                    >
                      <SelectTrigger id="evidence-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVIDENCE_TYPES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="evidence-url">Source URL (optional)</Label>
                  <Input
                    id="evidence-url"
                    value={draft.url}
                    onChange={(e) => {
                      setDraft((prev) => ({ ...prev, url: e.target.value }));
                      setAnalysisItems([]);
                    }}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label htmlFor="evidence-text">Paste Evidence Text</Label>
                  <Textarea
                    id="evidence-text"
                    value={draft.text}
                    onChange={(e) => {
                      setDraft((prev) => ({ ...prev, text: e.target.value }));
                      setAnalysisItems([]);
                    }}
                    placeholder="Paste a project summary, certificate text, paper abstract, or any other evidence here..."
                    rows={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="evidence-file">Upload PDF / DOCX / TXT / MD</Label>
                  <Input
                    id="evidence-file"
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    multiple
                    onChange={(e) => {
                      setFiles(Array.from(e.target.files || []));
                      setAnalysisItems([]);
                    }}
                  />
                  {files.length ? (
                    <div className="text-xs text-gray-500">
                      Selected {files.length} file{files.length === 1 ? "" : "s"}: {files.map((entry) => entry.name).join(", ")}
                    </div>
                  ) : null}
                </div>

                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
                >
                  {analyzing ? "Analyzing..." : (
                    <>
                      <ScanSearch className="mr-2 h-4 w-4" />
                      {draft.id ? "Re-analyze Skills" : "Analyze Skills"}
                    </>
                  )}
                </Button>

                {analysisItems.length ? (
                  <div className="space-y-4">
                    {analysisItems.map((analysis) => (
                      <Card key={analysis.analysis_id} className="p-4">
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">Ready to save</div>
                            <div className="mt-3 grid gap-4 md:grid-cols-2">
                              <div>
                                <Label htmlFor={`${analysis.analysis_id}-title`}>Title</Label>
                                <Input
                                  id={`${analysis.analysis_id}-title`}
                                  value={analysis.title}
                                  onChange={(e) => updateAnalysisItem(analysis.analysis_id, { title: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`${analysis.analysis_id}-type`}>Category</Label>
                                <Select
                                  value={analysis.type}
                                  onValueChange={(value) => updateAnalysisItem(analysis.analysis_id, { type: value })}
                                >
                                  <SelectTrigger id={`${analysis.analysis_id}-type`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EVIDENCE_TYPES.map((option) => (
                                      <SelectItem key={`${analysis.analysis_id}:${option.value}`} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-gray-600">{analysis.source}</div>
                          </div>

                          <div>
                            <div className="mb-2 text-sm font-medium text-gray-900">Extracted skills</div>
                            {analysis.extracted_skills.length === 0 ? (
                              <div className="text-sm text-gray-500">No likely skills detected. You can still save the evidence without adding skills.</div>
                            ) : (
                              <div className="space-y-3">
                                {analysis.extracted_skills.map((skill) => {
                                  const checked = (selectedSkillIdsByAnalysis[analysis.analysis_id] || []).includes(skill.skill_id);
                                  return (
                                    <label key={`${analysis.analysis_id}:${skill.skill_id}`} className="flex items-start gap-3 rounded-md border p-3">
                                      <Checkbox checked={checked} onCheckedChange={(value) => toggleSkill(analysis.analysis_id, skill.skill_id, value === true)} />
                                      <div className="min-w-0">
                                        <div className="font-medium text-gray-900">{skill.skill_name}</div>
                                        <div className="mt-1 flex flex-wrap gap-2">
                                          {skill.category ? <Badge variant="outline">{skill.category}</Badge> : null}
                                          {skill.matched_on ? <Badge variant="secondary">Matched by {skill.matched_on}</Badge> : null}
                                          {skill.is_new ? <Badge className="bg-blue-50 text-[#1E3A8A] border-blue-200">New skill candidate</Badge> : null}
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="mb-2 text-sm font-medium text-gray-900">Stored excerpt</div>
                            <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">{analysis.text_excerpt}</div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : null}
              </div>

              <DialogFooter className="border-t px-6 py-4">
                <Button variant="outline" onClick={resetDraft} disabled={saving || analyzing}>
                  Reset
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={analysisItems.length === 0 || saving}
                  className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
                >
                  {saving ? "Saving..." : draft.id ? "Save Changes" : analysisItems.length > 1 ? "Save All Evidence" : "Save Evidence"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Card className="p-10 text-center">
          <Upload className="mx-auto h-8 w-8 text-gray-400" />
          <div className="mt-3 text-sm text-gray-600">No user-added evidence yet.</div>
          <div className="mt-1 text-xs text-gray-500">Add text or upload files to start building your evidence library.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => {
            const externalUrl = item.source && /^https?:\/\//i.test(item.source) ? item.source : "";
            return (
              <Card key={item.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#1E3A8A]" />
                      <h3 className="truncate text-base font-semibold text-gray-900">{item.title}</h3>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.type ? <Badge variant="outline">{item.type}</Badge> : null}
                      {(item.skill_ids || []).length ? <Badge variant="secondary">{item.skill_ids?.length} extracted skills</Badge> : null}
                    </div>
                  </div>

                  {externalUrl ? (
                    <a href={externalUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-[#1E3A8A]">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>

                <p className="mt-4 text-sm text-gray-600 line-clamp-5">{item.text_excerpt || item.description || ""}</p>

                <div className="mt-4 text-xs text-gray-500">Source: {item.source || "manual-entry"}</div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deletingId === item.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
