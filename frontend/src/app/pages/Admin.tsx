import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Database, RefreshCw, Shield, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api, type AdminJob, type AdminSummary, type AdminUserRecord } from "../services/api";
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
  const [jobFilter, setJobFilter] = useState("pending");
  const [savingRoleId, setSavingRoleId] = useState("");
  const [deactivatingUserId, setDeactivatingUserId] = useState("");
  const [moderatingJobId, setModeratingJobId] = useState("");

  const load = useCallback(async (status = jobFilter) => {
    setLoading(true);
    try {
      const [summaryData, userData, jobData] = await Promise.all([
        api.getAdminSummary(),
        api.listAdminUsers(),
        api.listAdminJobs(status),
      ]);
      setSummary(summaryData);
      setUsers(userData);
      setJobs(jobData);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load admin workspace");
    } finally {
      setLoading(false);
    }
  }, [jobFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const collectionRows = useMemo(
    () => Object.entries(summary?.collections ?? {}).sort((a, b) => a[0].localeCompare(b[0])),
    [summary]
  );

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
      setJobs((current) => current.filter((job) => job.id !== jobId));
      setSummary((current) =>
        current
          ? {
              ...current,
              pending_jobs: Math.max(0, current.pending_jobs - (jobFilter === "pending" ? 1 : 0)),
            }
          : current
      );
      toast.success(`Job ${moderationStatus}`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to moderate job");
    } finally {
      setModeratingJobId("");
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
                      <div className="mt-1 text-xs text-gray-600 dark:text-slate-300">{job.description_excerpt}</div>
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
    </div>
  );
}
