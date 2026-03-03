// frontend/src/app/pages/Skills.tsx
import { useEffect, useMemo, useState } from "react";
import { api, type Skill, type ConfirmationOut } from "../services/api";
import { useActivity } from "../context/ActivityContext";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router";

const PROF_LEVELS = [1, 2, 3, 4, 5] as const;
const SKILLS_PER_PAGE = 50;

// Profile mode: no snapshot required
const PROFILE_SNAPSHOT_ID: null = null;

function errMsg(e: any) {
  return String(e?.message || e || "Unknown error");
}

export function Skills() {
  const { user } = useAuth();
  const { recordActivity } = useActivity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [evidenceSkillIds, setEvidenceSkillIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Confirmation state (profile context)
  const [confirmation, setConfirmation] = useState<ConfirmationOut | null>(null);
  const [busySkillId, setBusySkillId] = useState<string>("");
  const [deletingSkillId, setDeletingSkillId] = useState<string>("");
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [selectedCustomSkillIds, setSelectedCustomSkillIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Add Skill dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [autoConfirmAfterCreate, setAutoConfirmAfterCreate] = useState(true);
  const [newSkill, setNewSkill] = useState({ name: "", category: "", aliases: "" });

  const refreshSkills = async () => {
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
  };

  const refreshConfirmation = async () => {
    const c = await api.getProfileConfirmation();
    setConfirmation(c);
  };

  const refreshEvidenceSkills = async () => {
    if (!user?.id) {
      setEvidenceSkillIds([]);
      return;
    }
    const rows = await api.listEvidence({ user_id: user.id, origin: "user" });
    const ids = Array.from(
      new Set(
        rows.flatMap((row) => (Array.isArray(row.skill_ids) ? row.skill_ids : [])).map((value) => String(value || "").trim()).filter(Boolean)
      )
    );
    setEvidenceSkillIds(ids);
  };

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
  }, [user?.id]);

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

  const evidenceSkillIdSet = useMemo(() => new Set(evidenceSkillIds), [evidenceSkillIds]);
  const visibleSkillIdSet = useMemo(
    () => new Set(skills.map((skill) => String(skill.id || "").trim()).filter(Boolean)),
    [skills]
  );
  const visibleConfirmedSkillIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of confirmedMap.keys()) {
      if (visibleSkillIdSet.has(id)) ids.add(id);
    }
    return ids;
  }, [confirmedMap, visibleSkillIdSet]);
  const visibleEvidenceSkillIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of evidenceSkillIdSet) {
      if (visibleSkillIdSet.has(id)) ids.add(id);
    }
    return ids;
  }, [evidenceSkillIdSet, visibleSkillIdSet]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of skills) {
      const belongsToUser = visibleConfirmedSkillIds.has(s.id) || visibleEvidenceSkillIds.has(s.id);
      if (!belongsToUser) continue;
      const c = (s.category ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [skills, visibleConfirmedSkillIds, visibleEvidenceSkillIds]);

  const filteredSkills = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return skills.filter((s) => {
      const belongsToUser = visibleConfirmedSkillIds.has(s.id) || visibleEvidenceSkillIds.has(s.id);
      if (!belongsToUser) return false;

      const name = (s.name ?? "").toLowerCase();
      const cat = (s.category ?? "").toLowerCase();
      const aliases = Array.isArray(s.aliases) ? s.aliases.join(" ").toLowerCase() : "";

      const matchesTerm = !term || name.includes(term) || cat.includes(term) || aliases.includes(term);
      const matchesCategory = categoryFilter === "all" || (s.category ?? "") === categoryFilter;

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

  const customSkills = useMemo(
    () => skills.filter((skill) => skill.can_delete).sort((a, b) => a.name.localeCompare(b.name)),
    [skills]
  );

  const selectedCustomSkills = useMemo(
    () => customSkills.filter((skill) => selectedCustomSkillIds.includes(skill.id)),
    [customSkills, selectedCustomSkillIds]
  );

  const handleToggleConfirm = async (skillId: string) => {
    const id = (skillId ?? "").trim();
    if (!id) {
      toast.error("This skill is missing an id from the backend (check /skills reponse).");
      return;
    }
    const wasConfirmed = confirmedMap.has(skillId);

    try {
      setBusySkillId(skillId);
      await api.toggleConfirmSkill(PROFILE_SNAPSHOT_ID, skillId);
      await refreshConfirmation();
      recordActivity({
        id: `skills:${skillId}`,
        type: "skills",
        action: wasConfirmed ? "unconfirmed" : "confirmed",
        name: skills.find((skill) => skill.id === skillId)?.name || "Skill",
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

    try {
      setBusySkillId(skillId);
      await api.setSkillProficiency(PROFILE_SNAPSHOT_ID, skillId, p);
      await refreshConfirmation();
      recordActivity({
        id: `skills:proficiency:${skillId}`,
        type: "skills",
        action: "updated",
        name: `${skills.find((skill) => skill.id === skillId)?.name || "Skill"} proficiency set to ${p}`,
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

  const handleDeleteCustomSkill = async (skill: Skill) => {
    if (!skill.can_delete) return;
    if (!window.confirm(`Delete custom skill "${skill.name}"? This cannot be undone.`)) return;

    try {
      setDeletingSkillId(skill.id);
      await api.deleteSkill(skill.id);
      setSkills((prev) => prev.filter((item) => item.id !== skill.id));
      setSelectedCustomSkillIds((prev) => prev.filter((id) => id !== skill.id));
      await Promise.all([refreshConfirmation(), refreshEvidenceSkills()]);
      recordActivity({
        id: `skills:delete:${skill.id}`,
        type: "skills",
        action: "deleted",
        name: skill.name,
      });
      toast.success("Custom skill deleted");
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to delete skill: ${errMsg(e)}`);
    } finally {
      setDeletingSkillId("");
    }
  };

  const toggleSelectedCustomSkill = (skillId: string, checked: boolean) => {
    setSelectedCustomSkillIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(skillId);
      else next.delete(skillId);
      return Array.from(next);
    });
  };

  const handleBulkDeleteSelected = async () => {
    if (!selectedCustomSkills.length) {
      toast.error("Select at least one custom skill");
      return;
    }
    const count = selectedCustomSkills.length;
    if (!window.confirm(`Delete ${count} custom skill${count === 1 ? "" : "s"}? This cannot be undone.`)) return;

    try {
      setBulkDeleting(true);
      for (const skill of selectedCustomSkills) {
        await api.deleteSkill(skill.id);
        recordActivity({
          id: `skills:delete:${skill.id}`,
          type: "skills",
          action: "deleted",
          name: skill.name,
        });
      }
      await Promise.all([refreshSkills(), refreshConfirmation(), refreshEvidenceSkills()]);
      setSelectedCustomSkillIds([]);
      toast.success(`${count} custom skill${count === 1 ? "" : "s"} deleted`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to delete selected skills: ${errMsg(e)}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading skills...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top bar: search/filter + Add Skill */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
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

        <div className="flex flex-wrap items-center gap-3">
          <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Manage Custom Skills</Button>
            </DialogTrigger>

            <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
              <div className="flex h-full max-h-[85vh] flex-col">
                <DialogHeader className="border-b px-6 py-4">
                  <DialogTitle>Manage Custom Skills</DialogTitle>
                </DialogHeader>

                <div className="flex items-center justify-between gap-3 border-b px-6 py-3">
                  <p className="text-sm text-gray-600">
                    Delete skills you created through evidence or the add-skill flow.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedCustomSkillIds(customSkills.map((skill) => skill.id))}
                      disabled={!customSkills.length || bulkDeleting}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedCustomSkillIds([])}
                      disabled={!selectedCustomSkillIds.length || bulkDeleting}
                    >
                      Clear
                    </Button>
                    <Button
                      className="bg-red-600 text-white hover:bg-red-700"
                      onClick={handleBulkDeleteSelected}
                      disabled={!selectedCustomSkills.length || bulkDeleting}
                    >
                      {bulkDeleting ? "Deleting..." : `Delete Selected (${selectedCustomSkills.length})`}
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {customSkills.length === 0 ? (
                    <p className="text-sm text-gray-500">No custom skills to manage.</p>
                  ) : (
                    <div className="space-y-3">
                      {customSkills.map((skill) => {
                        const checked = selectedCustomSkillIds.includes(skill.id);
                        const confirmed = confirmedMap.has(skill.id);
                        const evidenceBacked = evidenceSkillIdSet.has(skill.id);

                        return (
                          <label
                            key={skill.id}
                            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={(e) => toggleSelectedCustomSkill(skill.id, e.target.checked)}
                              disabled={bulkDeleting}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{skill.name}</span>
                                {skill.category ? <Badge variant="secondary">{skill.category}</Badge> : null}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {confirmed ? <Badge className="bg-green-50 text-green-700">Confirmed</Badge> : null}
                                {evidenceBacked ? <Badge className="bg-blue-50 text-blue-700">Used in evidence</Badge> : null}
                                {!confirmed && !evidenceBacked ? (
                                  <Badge className="bg-amber-50 text-amber-700">Orphaned</Badge>
                                ) : null}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
              <Button className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90">
                <Plus className="h-4 w-4 mr-2" />
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

                <Button onClick={handleCreateSkill} className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90">
                  Create Skill
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {unsupportedConfirmedSkills.length > 0 ? (
        <Card className="p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Confirmed Skills Without Evidence</h3>
              <p className="text-sm text-gray-600">
                These skills are confirmed on your profile, but you do not have any supporting evidence attached yet.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/app/evidence?add=1">Upload Evidence</Link>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {unsupportedConfirmedSkills.map((skill) => (
              <Badge key={skill.id} variant="outline" className="border-amber-300 text-amber-700">
                {skill.name}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Skills Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pagedSkills.map((skill) => {
          const confirmed = confirmedMap.has(skill.id);
          const confirmationEntry = confirmed ? confirmedMap.get(skill.id)! : null;

          // Bind the dropdown to the user's manual setting so evidence auto-raises do not mask UI changes.
          const rawManualProf = confirmed ? (confirmationEntry!.manualProficiency ?? confirmationEntry!.proficiency ?? 1) : 1;
          const prof = confirmed ? String(Math.max(1, Math.min(5, rawManualProf))) : "";

          return (
            <Card key={skill.id} className="p-4 transition-shadow hover:shadow-md">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="text-base font-semibold leading-tight text-gray-900">{skill.name}</h3>
                  <p className="text-xs text-gray-600">{skill.category || ""}</p>
                  {Array.isArray(skill.aliases) && skill.aliases.length > 0 && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">Also known as: {skill.aliases.join(", ")}</p>
                  )}
                </div>

                <div className="shrink-0">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className={
                        confirmed
                          ? "h-8 px-2.5 text-xs bg-gray-200 text-gray-700 hover:bg-gray-300"
                          : "h-8 px-2.5 text-xs bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
                      }
                      onClick={() => handleToggleConfirm(skill.id)}
                      disabled={busySkillId === skill.id}
                    >
                      {busySkillId === skill.id ? "Working..." : confirmed ? "Unconfirm" : "Confirm"}
                    </Button>
                    {skill.can_delete ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCustomSkill(skill)}
                        disabled={deletingSkillId === skill.id}
                        className="h-8 w-8 shrink-0 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Delete ${skill.name}`}
                        title={`Delete ${skill.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex min-h-6 items-center gap-2">
                {skill.category ? <Badge variant="secondary" className="px-2 py-0 text-[11px]">{skill.category}</Badge> : null}
              </div>

              <div className="mt-3">
                <div className="mb-1 text-[11px] text-gray-600">Proficiency (1–5)</div>
                {confirmed && confirmationEntry && confirmationEntry.evidenceCount > 0 ? (
                  <div className="mb-2 text-[11px] leading-snug text-gray-500">
                    {confirmationEntry.evidenceCount} evidence item{confirmationEntry.evidenceCount === 1 ? "" : "s"} support this skill.
                    {confirmationEntry.autoProficiency > confirmationEntry.manualProficiency
                      ? ` Auto-raised to ${confirmationEntry.autoProficiency}.`
                      : ""}
                  </div>
                ) : null}
                <Select
                  value={prof}
                  onValueChange={(v) => handleProficiencyChange(skill.id, v)}
                  disabled={!confirmed || busySkillId === skill.id}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={confirmed ? "Select proficiency..." : "Confirm skill to set proficiency"} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROF_LEVELS.map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
