import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Database, LifeBuoy, RefreshCw, Shield, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { api, type AdminHelpRequest, type AdminJob, type AdminSkill, type AdminSummary, type AdminUserRecord } from "../services/api";
import { useHeaderTheme } from "../lib/headerTheme";
import { useAuth } from "../context/AuthContext";
import { AdminSectionNav } from "../components/AdminSectionNav";

const ADMIN_ROLES = ["user", "team", "admin", "owner"];

export function Admin() {
  const { activeHeaderTheme } = useHeaderTheme();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [skills, setSkills] = useState<AdminSkill[]>([]);
  const [helpRequests, setHelpRequests] = useState<AdminHelpRequest[]>([]);
  const [helpResponseDrafts, setHelpResponseDrafts] = useState<Record<string, string>>({});
  const [jobFilter, setJobFilter] = useState("pending");
  const [helpFilter, setHelpFilter] = useState("open");
  const [skillSearch, setSkillSearch] = useState("");
  const [savingRoleId, setSavingRoleId] = useState("");
  const [deactivatingUserId, setDeactivatingUserId] = useState("");
  const [moderatingJobId, setModeratingJobId] = useState("");
  const [moderatingHelpId, setModeratingHelpId] = useState("");
  const [deletingSkillId, setDeletingSkillId] = useState("");

  const load = useCallback(async (status = jobFilter, helpStatus = helpFilter) => {
    setLoading(true);
    try {
      const [summaryData, userData, jobData, skillData, helpData] = await Promise.all([
        api.getAdminSummary(),
        api.listAdminUsers(),
        api.listAdminJobs(status),
        api.listAdminSkills({ include_hidden: true, limit: 400 }),
        api.listAdminHelpRequests(helpStatus),
      ]);
      setSummary(summaryData);
      setUsers(userData);
      setJobs(jobData);
      setSkills(skillData);
      setHelpRequests(helpData);
      setHelpResponseDrafts((current) => {
        const next = { ...current };
        for (const entry of helpData) {
          if (!(entry.id in next)) {
            next[entry.id] = entry.admin_response ?? "";
          }
        }
        return next;
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to load admin workspace");
    } finally {
      setLoading(false);
    }
  }, [helpFilter, jobFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const collectionRows = useMemo(
    () => Object.entries(summary?.collections ?? {}).sort((a, b) => a[0].localeCompare(b[0])),
    [summary]
  );
  const filteredSkills = useMemo(() => {
    const term = skillSearch.trim().toLowerCase();
    if (!term) return skills;
    return skills.filter((entry) =>
      [entry.name, entry.category, entry.origin, ...entry.aliases, ...entry.tags]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [skillSearch, skills]);

  const updateRole = async (userId: string, role: string) => {
    setSavingRoleId(userId);
    try {
      const updated = await api.updateAdminUserRole(userId, role);
      setUsers((current) => current.map((user) => (user.id === userId ? updated : user)));
      toast.success("User role updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update role");
    } finally {
      setSavingRoleId("");
    }
  };

  const deactivateUser = async (userRecord: AdminUserRecord) => {
    if (userRecord.id === currentUser?.id || !userRecord.is_active) return;

    const confirmed = window.confirm(`Deactivate ${userRecord.username}'s account? They will lose access but remain in the database.`);
    if (!confirmed) return;

    setDeactivatingUserId(userRecord.id);
    try {
      await api.deactivateAdminUser(userRecord.id);
      setUsers((current) =>
        current.map((entry) =>
          entry.id === userRecord.id
            ? {
                ...entry,
                is_active: false,
                deactivated_at: new Date().toISOString(),
              }
            : entry
        )
      );
      setSummary((current) =>
        current
          ? {
              ...current,
              team_members:
                ["team", "admin", "owner"].includes(userRecord.role) && current.team_members > 0
                  ? current.team_members - 1
                  : current.team_members,
            }
          : current
      );
      toast.success("User account deactivated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to deactivate user");
    } finally {
      setDeactivatingUserId("");
    }
  };

  const moderateJob = async (jobId: string, moderationStatus: "approved" | "rejected") => {
    setModeratingJobId(jobId);
    try {
      await api.moderateAdminJob(jobId, {
        moderation_status: moderationStatus,
        moderation_reason: moderationStatus === "rejected" ? "Rejected from admin workspace" : null,
      });
      await load(jobFilter);
      toast.success(`Job ${moderationStatus}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to moderate job");
    } finally {
      setModeratingJobId("");
    }
  };

  const moderateHelpRequest = async (requestId: string, status: "open" | "in_review" | "resolved") => {
    setModeratingHelpId(requestId);
    try {
      await api.updateAdminHelpRequest(requestId, {
        status,
        admin_response: helpResponseDrafts[requestId] ?? "",
      });
      await load(jobFilter, helpFilter);
      toast.success(`Help request marked ${status.replace("_", " ")}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update help request");
    } finally {
      setModeratingHelpId("");
    }
  };

  const deleteSkill = async (skill: AdminSkill) => {
    if (!window.confirm(`Delete skill "${skill.name}"? This will remove linked references across the platform.`)) return;

    setDeletingSkillId(skill.id);
    try {
      await api.deleteSkill(skill.id);
      setSkills((current) => current.filter((entry) => entry.id !== skill.id));
      setSummary((current) =>
        current
          ? {
              ...current,
              skills: Math.max(0, current.skills - 1),
              collections: {
                ...current.collections,
                skills: Math.max(0, Number(current.collections.skills ?? current.skills) - 1),
              },
            }
          : current
      );
      toast.success("Skill deleted");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete skill");
    } finally {
      setDeletingSkillId("");
    }
  };

  if (loading && !summary) {
    return (
      <div className="max-w-7xl space-y-6">
        <AdminSectionNav />
        <div className="p-6 text-sm text-gray-600 dark:text-slate-300">Loading admin workspace...</div>
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
                <Shield className={`h-3.5 w-3.5 ${activeHeaderTheme.accentTextClass}`} />
                Admin Workspace
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Owner and team control center</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Manage users, moderate job submissions, and monitor the live system without exposing these tools to standard users.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => load(jobFilter)}
              className="border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Users</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{summary?.total_users ?? 0}</p>
            </div>
            <Users className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
        </Card>
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Team Members</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{summary?.team_members ?? 0}</p>
            </div>
            <Shield className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
        </Card>
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Pending Jobs</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">{summary?.pending_jobs ?? 0}</p>
            </div>
            <Briefcase className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
        </Card>
        <Card className="p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">AI Mode</p>
              <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-slate-100">{summary?.provider_mode ?? "Unknown"}</p>
            </div>
            <Sparkles className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">User Access</h2>
              <p className="text-sm text-gray-600 dark:text-slate-300">Promote or adjust team access without exposing account controls to end users.</p>
            </div>
            <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
              {users.length} users
            </Badge>
          </div>

          <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader className="bg-slate-50/90 dark:bg-slate-950/80">
                <TableRow className="border-slate-200 dark:border-slate-800">
                  <TableHead className="text-slate-700 dark:text-slate-300">User</TableHead>
                  <TableHead className="text-slate-700 dark:text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-700 dark:text-slate-300">Role</TableHead>
                  <TableHead className="text-slate-700 dark:text-slate-300">Created</TableHead>
                  <TableHead className="text-right text-slate-700 dark:text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-slate-200 dark:border-slate-800 dark:hover:bg-slate-950/60">
                    <TableCell className="whitespace-normal">
                      <div className="font-medium text-gray-900 dark:text-slate-100">{user.username}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">{user.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="outline"
                          className={
                            user.is_active
                              ? "w-fit border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "w-fit border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                          }
                        >
                          {user.is_active ? "Active" : "Deactivated"}
                        </Badge>
                        {!user.is_active && user.deactivated_at ? (
                          <span className="text-[11px] text-gray-500 dark:text-slate-400">{new Date(user.deactivated_at).toLocaleString()}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => updateRole(user.id, value)}
                        disabled={savingRoleId === user.id || deactivatingUserId === user.id || !user.is_active}
                      >
                        <SelectTrigger className="w-[140px] dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                          {ADMIN_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 dark:text-slate-400">
                      {user.created_at ? new Date(user.created_at).toLocaleString() : "Unknown"}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.id === currentUser?.id ? (
                        <span className="text-xs text-gray-500 dark:text-slate-400">Current account</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deactivateUser(user)}
                          disabled={deactivatingUserId === user.id || savingRoleId === user.id || !user.is_active}
                          className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900 dark:bg-slate-950/70 dark:text-rose-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-200"
                        >
                          {user.is_active ? "Deactivate" : "Deactivated"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">System Snapshot</h2>
              <p className="text-sm text-gray-600 dark:text-slate-300">Live collection totals for quick operator visibility.</p>
            </div>
            <Database className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
          <div className="space-y-3">
            {collectionRows.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
                <span className="text-sm font-medium capitalize text-gray-900 dark:text-slate-100">{name.replace(/_/g, " ")}</span>
                <span className="text-sm text-gray-600 dark:text-slate-300">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Skill Review</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">Only admins can remove skills. Review the catalog here before deleting anything user-facing.</p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              value={skillSearch}
              onChange={(event) => setSkillSearch(event.target.value)}
              placeholder="Search skills, aliases, tags..."
              className="w-full md:w-72 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            />
            <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
              {filteredSkills.length} skills
            </Badge>
          </div>
        </div>

        <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader className="bg-slate-50/90 dark:bg-slate-950/80">
              <TableRow className="border-slate-200 dark:border-slate-800">
                <TableHead className="text-slate-700 dark:text-slate-300">Skill</TableHead>
                <TableHead className="text-slate-700 dark:text-slate-300">Origin</TableHead>
                <TableHead className="text-slate-700 dark:text-slate-300">Usage</TableHead>
                <TableHead className="text-right text-slate-700 dark:text-slate-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSkills.length === 0 ? (
                <TableRow className="border-slate-200 dark:border-slate-800">
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                    No skills match this review filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSkills.map((skill) => (
                  <TableRow key={skill.id} className="border-slate-200 dark:border-slate-800 dark:hover:bg-slate-950/60">
                    <TableCell className="whitespace-normal">
                      <div className="font-medium text-gray-900 dark:text-slate-100">{skill.name}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {skill.category || "Uncategorized"}
                        {skill.created_by_user_id ? ` • created by ${skill.created_by_user_id}` : ""}
                      </div>
                      {skill.aliases.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {skill.aliases.slice(0, 4).map((alias) => (
                            <Badge key={`${skill.id}:${alias}`} variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                              {alias}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="capitalize dark:border-slate-700 dark:text-slate-200">
                          {skill.origin}
                        </Badge>
                        {skill.hidden ? (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                            Hidden
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm text-gray-600 dark:text-slate-300">
                      <div>{skill.evidence_count} evidence item{skill.evidence_count === 1 ? "" : "s"}</div>
                      <div>{skill.project_link_count} project link{skill.project_link_count === 1 ? "" : "s"}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteSkill(skill)}
                        disabled={deletingSkillId === skill.id}
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900 dark:bg-slate-950/70 dark:text-rose-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-200"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingSkillId === skill.id ? "Deleting..." : "Delete"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Job Moderation</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">Approve or reject submitted jobs before they shape the catalog and role weighting.</p>
          </div>
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger className="w-[180px] dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader className="bg-slate-50/90 dark:bg-slate-950/80">
              <TableRow className="border-slate-200 dark:border-slate-800">
                <TableHead className="text-slate-700 dark:text-slate-300">Job</TableHead>
                <TableHead className="text-slate-700 dark:text-slate-300">Status</TableHead>
                <TableHead className="text-slate-700 dark:text-slate-300">Required Skills</TableHead>
                <TableHead className="text-slate-700 dark:text-slate-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow className="border-slate-200 dark:border-slate-800">
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                    No jobs found for this moderation state.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id} className="border-slate-200 dark:border-slate-800 dark:hover:bg-slate-950/60">
                    <TableCell className="whitespace-normal">
                      <div className="font-medium text-gray-900 dark:text-slate-100">{job.title}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {[job.company, job.location].filter(Boolean).join(" • ") || job.source}
                      </div>
                      {job.submitted_by_user_id ? (
                        <div className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                          Submitted by {job.submitted_by_user_id}
                        </div>
                      ) : null}
                      <div className="mt-1 text-xs text-gray-600 dark:text-slate-300">{job.description_excerpt}</div>
                      {job.description_full && job.description_full !== job.description_excerpt ? (
                        <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                          <summary className="cursor-pointer font-medium text-slate-900 dark:text-slate-100">
                            View submitted job text
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap leading-5 text-slate-600 dark:text-slate-300">
                            {job.description_full}
                          </p>
                        </details>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize dark:border-slate-700 dark:text-slate-200">
                        {job.moderation_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-wrap gap-2">
                        {job.required_skills.slice(0, 6).map((skill) => (
                          <Badge key={`${job.id}:${skill}`} className="border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => moderateJob(job.id, "approved")}
                          disabled={moderatingJobId === job.id || job.moderation_status === "approved"}
                          className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => moderateJob(job.id, "rejected")}
                          disabled={moderatingJobId === job.id || job.moderation_status === "rejected"}
                          className="dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LifeBuoy className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Help Requests</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300">Review onboarding and workflow issues submitted from the account help page.</p>
          </div>
          <Select value={helpFilter} onValueChange={setHelpFilter}>
            <SelectTrigger className="w-[180px] dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader className="bg-slate-50/90 dark:bg-slate-950/80">
              <TableRow className="border-slate-200 dark:border-slate-800">
                <TableHead className="text-slate-700 dark:text-slate-300">Request</TableHead>
                <TableHead className="text-slate-700 dark:text-slate-300">Status</TableHead>
                <TableHead className="text-slate-700 dark:text-slate-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {helpRequests.length === 0 ? (
                <TableRow className="border-slate-200 dark:border-slate-800">
                  <TableCell colSpan={3} className="py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                    No help requests found for this status.
                  </TableCell>
                </TableRow>
              ) : (
                helpRequests.map((entry) => (
                  <TableRow key={entry.id} className="border-slate-200 dark:border-slate-800 dark:hover:bg-slate-950/60">
                    <TableCell className="whitespace-normal">
                      <div className="font-medium text-gray-900 dark:text-slate-100">{entry.subject}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {[entry.username || entry.user_email, entry.category, entry.page].filter(Boolean).join(" • ")}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{entry.message}</p>
                      {entry.admin_response ? (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                          <span className="font-medium text-slate-900 dark:text-slate-100">Admin response:</span> {entry.admin_response}
                        </div>
                      ) : null}
                      <div className="mt-3 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Draft response
                        </div>
                        <Textarea
                          value={helpResponseDrafts[entry.id] ?? ""}
                          onChange={(event) =>
                            setHelpResponseDrafts((current) => ({
                              ...current,
                              [entry.id]: event.target.value,
                            }))
                          }
                          placeholder="Write the response the user should see."
                          rows={4}
                          className="resize-none text-sm dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize dark:border-slate-700 dark:text-slate-200">
                        {entry.status.replace("_", " ")}
                      </Badge>
                      <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => moderateHelpRequest(entry.id, "in_review")}
                          disabled={moderatingHelpId === entry.id || entry.status === "in_review"}
                          className="dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                        >
                          Save + in review
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => moderateHelpRequest(entry.id, "resolved")}
                          disabled={moderatingHelpId === entry.id || entry.status === "resolved"}
                          className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
                        >
                          Save + resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moderateHelpRequest(entry.id, "open")}
                          disabled={moderatingHelpId === entry.id || entry.status === "open"}
                        >
                          Reopen
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
