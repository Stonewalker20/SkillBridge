// frontend/src/app/pages/Skills.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Skill, type ConfirmationOut, type Evidence } from "../services/api";
import { useActivity } from "../context/ActivityContext";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { AlertCircle, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router";
import { useHeaderTheme } from "../lib/headerTheme";

const PROF_LEVELS = [1, 2, 3, 4, 5] as const;
const SKILLS_PER_PAGE = 50;

// Profile mode: no snapshot required
const PROFILE_SNAPSHOT_ID: null = null;

function errMsg(e: any) {
  return String(e?.message || e || "Unknown error");
}

function skillVariantIds(skill: Skill): string[] {
  const merged = Array.isArray(skill.merged_ids) ? skill.merged_ids.map((value) => String(value || "").trim()).filter(Boolean) : [];
  const ownId = String(skill.id || "").trim();
  return Array.from(new Set([ownId, ...merged].filter(Boolean)));
}

function skillCategoryList(skill: Skill): string[] {
  const categories = Array.isArray(skill.categories) ? skill.categories.map((value) => String(value || "").trim()).filter(Boolean) : [];
  if (categories.length > 0) return Array.from(new Set(categories));
  const single = String(skill.category || "").trim();
  return single ? [single] : [];
}

function evidenceTypeLabel(value?: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) return "Evidence";
  return normalized
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function evidenceTitle(entry: Pick<Evidence, "title" | "source" | "type">): string {
  const title = String(entry.title || "").trim();
  if (title) return title;
  const source = String(entry.source || "").trim();
  if (source) return source;
  return `${evidenceTypeLabel(entry.type)} evidence`;
}

export function Skills() {
  const { user } = useAuth();
  const { recordActivity } = useActivity();
  const { activeHeaderTheme } = useHeaderTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Confirmation state (profile context)
  const [confirmation, setConfirmation] = useState<ConfirmationOut | null>(null);
  const [busySkillId, setBusySkillId] = useState<string>("");

  // Add Skill dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [autoConfirmAfterCreate, setAutoConfirmAfterCreate] = useState(true);
  const [newSkill, setNewSkill] = useState({ name: "", category: "", aliases: "" });

  const refreshSkills = useCallback(async () => {
    const pageSize = 200;
    const allSkills: Skill[] = [];
    let skip = 0;

    while (true) {
      const batch = await api.listSkills({ limit: pageSize, skip });
      if (!Array.isArray(batch) || batch.length === 0) break;
      allSkills.push(...batch);
      if (batch.length < pageSize) break;
      skip += pageSize;
    }

    setSkills(allSkills);
  }, []);

  const refreshConfirmation = useCallback(async () => {
    const c = await api.getProfileConfirmation();
    setConfirmation(c);
  }, []);

  const refreshEvidenceSkills = useCallback(async () => {
    if (!user?.id) {
      setEvidenceItems([]);
      return;
    }
    const rows = await api.listEvidence({ user_id: user.id, origin: "user" });
    setEvidenceItems(rows);
  }, [user?.id]);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      try {
        await Promise.all([refreshSkills(), refreshConfirmation(), refreshEvidenceSkills()]);
      } catch (e) {
        console.error(e);
        toast.error(`Failed to load skills: ${errMsg(e)}`);
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, [refreshConfirmation, refreshEvidenceSkills, refreshSkills]);

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setIsAddOpen(true);
    }
  }, [searchParams]);

  const confirmedMap = useMemo(() => {
    const m = new Map<string, { proficiency: number; manualProficiency: number; autoProficiency: number; evidenceCount: number }>();
    for (const e of confirmation?.confirmed ?? []) {
      const id = (e?.skill_id ?? "").trim();
      if (!id) continue;
      const p = typeof e.proficiency === "number" ? e.proficiency : 0;
      m.set(id, {
        proficiency: p,
        manualProficiency: typeof e.manual_proficiency === "number" ? e.manual_proficiency : p,
        autoProficiency: typeof e.auto_proficiency === "number" ? e.auto_proficiency : 0,
        evidenceCount: typeof e.evidence_count === "number" ? e.evidence_count : 0,
      });
    }
    return m;
  }, [confirmation]);

  const evidenceBySkillId = useMemo(() => {
    const map = new Map<string, Evidence[]>();
    for (const item of evidenceItems) {
      for (const skillId of Array.isArray(item.skill_ids) ? item.skill_ids.map((value) => String(value || "").trim()).filter(Boolean) : []) {
        const existing = map.get(skillId) ?? [];
        existing.push(item);
        map.set(skillId, existing);
      }
    }
    return map;
  }, [evidenceItems]);
  const evidenceSkillIdSet = useMemo(() => new Set(evidenceBySkillId.keys()), [evidenceBySkillId]);
  const visibleSkillIdSet = useMemo(
    () => new Set(skills.map((skill) => String(skill.id || "").trim()).filter(Boolean)),
    [skills]
  );
  const visibleConfirmedSkillIds = useMemo(
    () =>
      new Set(
        skills
          .filter((skill) => skillVariantIds(skill).some((id) => confirmedMap.has(id)))
          .map((skill) => skill.id)
          .filter((id) => visibleSkillIdSet.has(id))
      ),
    [skills, confirmedMap, visibleSkillIdSet]
  );
  const visibleEvidenceSkillIds = useMemo(
    () =>
      new Set(
        skills
          .filter((skill) => skillVariantIds(skill).some((id) => evidenceSkillIdSet.has(id)))
          .map((skill) => skill.id)
          .filter((id) => visibleSkillIdSet.has(id))
      ),
    [skills, evidenceSkillIdSet, visibleSkillIdSet]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of skills) {
      const belongsToUser = visibleConfirmedSkillIds.has(s.id) || visibleEvidenceSkillIds.has(s.id);
      if (!belongsToUser) continue;
      for (const c of skillCategoryList(s)) {
        if (c) set.add(c);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [skills, visibleConfirmedSkillIds, visibleEvidenceSkillIds]);

  const filteredSkills = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return skills.filter((s) => {
      const belongsToUser = visibleConfirmedSkillIds.has(s.id) || visibleEvidenceSkillIds.has(s.id);
      if (!belongsToUser) return false;

      const name = (s.name ?? "").toLowerCase();
      const cat = skillCategoryList(s).join(" ").toLowerCase();
      const aliases = Array.isArray(s.aliases) ? s.aliases.join(" ").toLowerCase() : "";

      const matchesTerm = !term || name.includes(term) || cat.includes(term) || aliases.includes(term);
      const matchesCategory = categoryFilter === "all" || skillCategoryList(s).includes(categoryFilter);

      return matchesTerm && matchesCategory;
    });
  }, [skills, searchTerm, categoryFilter, visibleConfirmedSkillIds, visibleEvidenceSkillIds]);

  const unsupportedConfirmedSkills = useMemo(
    () =>
      skills
        .filter((skill) => visibleConfirmedSkillIds.has(skill.id) && !visibleEvidenceSkillIds.has(skill.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [skills, visibleConfirmedSkillIds, visibleEvidenceSkillIds]
  );

  const totalPages = Math.max(1, Math.ceil(filteredSkills.length / SKILLS_PER_PAGE));
  const pagedSkills = useMemo(() => {
    const start = (page - 1) * SKILLS_PER_PAGE;
    return filteredSkills.slice(start, start + SKILLS_PER_PAGE);
  }, [filteredSkills, page]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, categoryFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleToggleConfirm = async (skillId: string) => {
    const id = (skillId ?? "").trim();
    if (!id) {
      toast.error("This skill is missing an id from the backend (check /skills reponse).");
      return;
    }
    const skill = skills.find((entry) => entry.id === skillId);
    const variantIds = skill ? skillVariantIds(skill) : [skillId];
    const confirmedVariantIds = variantIds.filter((variantId) => confirmedMap.has(variantId));
    const wasConfirmed = confirmedVariantIds.length > 0;

    try {
      setBusySkillId(skillId);
      if (wasConfirmed) {
        for (const variantId of confirmedVariantIds) {
          await api.unconfirmSkill(PROFILE_SNAPSHOT_ID, variantId);
        }
      } else {
        await api.confirmSkill(PROFILE_SNAPSHOT_ID, skillId);
      }
      await refreshConfirmation();
      recordActivity({
        id: `skills:${skillId}`,
        type: "skills",
        action: wasConfirmed ? "unconfirmed" : "confirmed",
        name: skill?.name || "Skill",
      });
      toast.success(wasConfirmed ? "Skill unconfirmed" : "Skill confirmed");
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to update confirmation: ${errMsg(e)}`);
    } finally {
      setBusySkillId("");
    }
  };

  const handleProficiencyChange = async (skillId: string, val: string) => {
    const p = parseInt(val, 10);
    if (!Number.isFinite(p)) return;
    const skill = skills.find((entry) => entry.id === skillId);
    const variantIds = skill ? skillVariantIds(skill) : [skillId];
    const confirmedVariantIds = variantIds.filter((variantId) => confirmedMap.has(variantId));
    const targetIds = confirmedVariantIds.length > 0 ? confirmedVariantIds : [skillId];

    try {
      setBusySkillId(skillId);
      for (const targetId of targetIds) {
        await api.setSkillProficiency(PROFILE_SNAPSHOT_ID, targetId, p);
      }
      await refreshConfirmation();
      recordActivity({
        id: `skills:proficiency:${skillId}`,
        type: "skills",
        action: "updated",
        name: `${skill?.name || "Skill"} proficiency set to ${p}`,
      });
      toast.success("Proficiency updated");
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to update proficiency: ${errMsg(e)}`);
    } finally {
      setBusySkillId("");
    }
  };

  const handleCreateSkill = async () => {
    const name = newSkill.name.trim();
    const category = newSkill.category.trim();
    if (!name || !category) {
      toast.error("Skill name and category are required");
      return;
    }

    const aliases = newSkill.aliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    try {
      const created = await api.createSkill({ name, category, aliases });
      toast.success("Skill added to database");
      await refreshSkills();
      recordActivity({
        id: `skills:create:${created.id}`,
        type: "skills",
        action: "added",
        name: created.name,
      });

      if (autoConfirmAfterCreate) {
        try {
          setBusySkillId(created.id);
          // confirm in profile context
          await api.confirmSkill(PROFILE_SNAPSHOT_ID, created.id);
          await refreshConfirmation();
          recordActivity({
            id: `skills:${created.id}`,
            type: "skills",
            action: "confirmed",
            name: created.name,
          });
          toast.success("Skill confirmed");
        } catch (e: any) {
          console.error(e);
          toast.error(`Created, but confirm failed: ${errMsg(e)}`);
        } finally {
          setBusySkillId("");
        }
      }

      setNewSkill({ name: "", category: "", aliases: "" });
      setIsAddOpen(false);
    } catch (e: any) {
      console.error(e);
      const msg = errMsg(e);
      if (msg.includes("409") || msg.toLowerCase().includes("already exists")) {
        toast.error("That skill already exists");
      } else {
        toast.error(`Failed to add skill: ${msg}`);
      }
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading skills...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top bar: search/filter + Add Skill */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            placeholder="Search skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:w-80"
          />

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="secondary">Confirmed: {visibleConfirmedSkillIds.size}</Badge>
          <Badge variant="secondary">From Evidence: {visibleEvidenceSkillIds.size}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Dialog
            open={isAddOpen}
            onOpenChange={(open) => {
              setIsAddOpen(open);
              if (!open && searchParams.get("add") === "1") {
                const next = new URLSearchParams(searchParams);
                next.delete("add");
                setSearchParams(next, { replace: true });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className={`h-10 rounded-xl px-4 text-sm font-medium whitespace-nowrap ${activeHeaderTheme.buttonClass}`}>
                <Plus className="mr-2 h-4 w-4" />
                Add Skill
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a new skill to the database</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-3">
                <div>
                  <Label htmlFor="skill-name">Skill Name *</Label>
                  <Input
                    id="skill-name"
                    value={newSkill.name}
                    onChange={(e) => setNewSkill((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., React"
                  />
                </div>

                <div>
                  <Label htmlFor="skill-category">Category *</Label>
                  <Input
                    id="skill-category"
                    value={newSkill.category}
                    onChange={(e) => setNewSkill((p) => ({ ...p, category: e.target.value }))}
                    placeholder="e.g., Frontend"
                  />
                </div>

                <div>
                  <Label htmlFor="skill-aliases">Aliases (comma-separated)</Label>
                  <Input
                    id="skill-aliases"
                    value={newSkill.aliases}
                    onChange={(e) => setNewSkill((p) => ({ ...p, aliases: e.target.value }))}
                    placeholder="e.g., ReactJS, React.js"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="auto-confirm"
                    type="checkbox"
                    checked={autoConfirmAfterCreate}
                    onChange={(e) => setAutoConfirmAfterCreate(e.target.checked)}
                  />
                  <Label htmlFor="auto-confirm">Auto-confirm after creating</Label>
                </div>

                <Button onClick={handleCreateSkill} className={`w-full ${activeHeaderTheme.buttonClass}`}>
                  Create Skill
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {unsupportedConfirmedSkills.length > 0 ? (
        <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle className="h-3.5 w-3.5" />
                Evidence Needed
              </div>
              <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-slate-100">Confirmed Skills Without Evidence</h3>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                These skills are confirmed on your profile, but you do not have any supporting evidence attached yet.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/app/evidence?add=1">Upload Evidence</Link>
            </Button>
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-[linear-gradient(135deg,_rgba(255,251,235,0.95),_rgba(255,255,255,0.92))] px-4 py-4 dark:border-amber-900/50 dark:bg-[linear-gradient(135deg,_rgba(69,26,3,0.34),_rgba(15,23,42,0.82))]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                <Sparkles className="h-4 w-4" />
                Add proof to strengthen these signals in job match and analytics.
              </div>
              <div className="rounded-full border border-amber-300 bg-white/80 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-slate-950/60 dark:text-amber-200">
                {unsupportedConfirmedSkills.length} pending
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {unsupportedConfirmedSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/85 px-3 py-1.5 text-sm text-amber-900 shadow-[0_8px_24px_-18px_rgba(180,83,9,0.55)] dark:border-amber-900/60 dark:bg-slate-950/70 dark:text-amber-100"
                >
                  <span className="h-2 w-2 rounded-full bg-[linear-gradient(135deg,_#f59e0b,_#f97316)]" />
                  <span className="font-medium">{skill.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {/* Skills Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
	        {pagedSkills.map((skill) => {
	          const variantIds = skillVariantIds(skill);
	          const variantEntries = variantIds.map((variantId) => confirmedMap.get(variantId)).filter(Boolean);
          const supportingEvidence = Array.from(
            new Map(
              variantIds
                .flatMap((variantId) => evidenceBySkillId.get(variantId) ?? [])
                .map((item) => [item.id, item] as const)
            ).values()
          );
	          const confirmed = variantEntries.length > 0;
	          const confirmationEntry = confirmed
	            ? {
                proficiency: Math.max(...variantEntries.map((entry) => entry!.proficiency)),
                manualProficiency: Math.max(...variantEntries.map((entry) => entry!.manualProficiency)),
                autoProficiency: Math.max(...variantEntries.map((entry) => entry!.autoProficiency)),
                evidenceCount: variantEntries.reduce((sum, entry) => sum + (entry?.evidenceCount ?? 0), 0),
              }
            : null;

	          const effectiveProficiency = confirmed
	            ? Math.max(1, Math.min(5, confirmationEntry!.proficiency ?? confirmationEntry!.manualProficiency ?? 1))
	            : 0;
	          const categoryList = skillCategoryList(skill);
          const hasSupportingEvidence = supportingEvidence.length > 0;
          const hiddenEvidenceCount = Math.max(0, supportingEvidence.length - 3);
          const aliases = Array.isArray(skill.aliases) ? skill.aliases.filter(Boolean) : [];
          const evidenceSummary = hasSupportingEvidence
            ? `${supportingEvidence.length} evidence item${supportingEvidence.length === 1 ? "" : "s"} currently support this skill's proficiency.`
            : confirmed
              ? "No saved evidence currently supports this proficiency score. This rating is based on confirmation only."
              : "No saved evidence currently supports this skill yet.";

	          return (
	            <Card key={skill.id} className="group relative overflow-visible p-3.5 transition-shadow hover:z-20 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="text-base font-semibold leading-tight text-gray-900 dark:text-slate-100">{skill.name}</h3>
                  <p className="text-xs text-gray-600 dark:text-slate-300">{categoryList.join(" • ")}</p>
                </div>

                <div className="shrink-0">
                  <Button
                    size="sm"
                    className={
                      confirmed
                        ? "h-8 rounded-lg px-2.5 text-xs bg-gray-200 text-gray-700 hover:bg-gray-300"
                        : `h-8 rounded-lg px-2.5 text-xs ${activeHeaderTheme.buttonClass}`
                    }
                    onClick={() => handleToggleConfirm(skill.id)}
                    disabled={busySkillId === skill.id}
                  >
                    {busySkillId === skill.id ? "Working..." : confirmed ? "Unconfirm" : "Confirm"}
                  </Button>
                </div>
              </div>

              <div className="flex min-h-6 items-center gap-2">
                {categoryList.map((category) => (
                  <Badge key={`${skill.id}:${category}`} variant="secondary" className="px-2 py-0 text-[11px] dark:bg-slate-800 dark:text-slate-200">
                    {category}
                  </Badge>
                ))}
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
                      {confirmed ? "Proficiency" : "Confirm to rate"}
                    </div>
                    <div className="mt-1 text-xs font-medium text-gray-900 dark:text-slate-100">
                      {confirmed ? `${effectiveProficiency}/5` : "Not confirmed"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {PROF_LEVELS.map((level) => {
                      const filled = confirmed && level <= effectiveProficiency;
                      return (
                        <button
                          key={`${skill.id}:proficiency:${level}`}
                          type="button"
                          onClick={() => handleProficiencyChange(skill.id, String(level))}
                          disabled={!confirmed || busySkillId === skill.id}
                          className={`h-4 w-4 rounded-full border transition ${filled ? "border-slate-900 bg-slate-900 dark:border-slate-100 dark:bg-slate-100" : "border-slate-300 bg-transparent dark:border-slate-600"} ${confirmed ? "hover:scale-110" : "cursor-not-allowed opacity-40"}`}
                          aria-label={`Set ${skill.name} proficiency to ${level}`}
                          title={confirmed ? `Set proficiency to ${level}` : "Confirm skill to set proficiency"}
                        />
                      );
                    })}
	                  </div>
	                </div>
	                <div className="pointer-events-none absolute inset-x-3.5 top-full z-30 mt-2 opacity-0 transition-opacity duration-200 ease-out group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/95 p-3 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
                            Evidence Support
                          </div>
                          <div className="mt-1 text-[11px] leading-snug text-gray-600 dark:text-slate-300">
                            {evidenceSummary}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 dark:border-slate-700 dark:text-slate-200">
                          {supportingEvidence.length} linked
                        </Badge>
                      </div>
                      {hasSupportingEvidence ? (
                        <div className="mt-3 space-y-2">
                          {supportingEvidence.slice(0, 3).map((item) => (
                            <div
                              key={`${skill.id}:evidence:${item.id}`}
                              className="rounded-lg border border-slate-200 bg-white/90 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/80"
                            >
                              <div className="text-[11px] font-medium text-slate-900 dark:text-slate-100">
                                {evidenceTitle(item)}
                              </div>
                              <div className="mt-1 line-clamp-2 text-[11px] text-gray-500 dark:text-slate-400">
                                {[evidenceTypeLabel(item.type), String(item.source || "").trim()].filter(Boolean).join(" • ")}
                              </div>
                            </div>
                          ))}
                          {hiddenEvidenceCount > 0 ? (
                            <div className="text-[11px] text-gray-500 dark:text-slate-400">
                              +{hiddenEvidenceCount} more linked evidence item{hiddenEvidenceCount === 1 ? "" : "s"}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-[11px] text-gray-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                          No evidence is currently supporting this skill's proficiency score.
                        </div>
                      )}
                      {confirmed && confirmationEntry && confirmationEntry.autoProficiency > confirmationEntry.manualProficiency ? (
                        <div className="mt-3 text-[11px] leading-snug text-gray-600 dark:text-slate-300">
                          Auto-raised from {confirmationEntry.manualProficiency} to {confirmationEntry.autoProficiency} based on evidence support.
                        </div>
                      ) : null}
                      {aliases.length > 0 ? (
                        <div className="mt-3 line-clamp-2 text-[11px] text-gray-500 dark:text-slate-400">
                          Also known as: {aliases.join(", ")}
                        </div>
                      ) : null}
                    </div>
	                </div>
	              </div>
	            </Card>
          );
        })}
      </div>

      {filteredSkills.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No skills found matching your search</p>
        </div>
      )}

      {filteredSkills.length > 0 ? (
        <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * SKILLS_PER_PAGE + 1}-{Math.min(page * SKILLS_PER_PAGE, filteredSkills.length)} of {filteredSkills.length} skills
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
              Previous
            </Button>
            <Badge variant="secondary">
              Page {page} of {totalPages}
            </Badge>
            <Button
              variant="outline"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
