import { useEffect, useState } from "react";
import { api, type TailoredResumeDetail, type TailoredResumeListEntry } from "../services/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Briefcase, Download, EyeOff, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useAuth } from "../context/AuthContext";
import { useHeaderTheme } from "../lib/headerTheme";

const RESUMES_PER_PAGE = 15;

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

export function TailoredResumes() {
  const { user } = useAuth();
  const { activeHeaderTheme } = useHeaderTheme();
  const [items, setItems] = useState<TailoredResumeListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [detail, setDetail] = useState<TailoredResumeDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState("");
  const [page, setPage] = useState(1);
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("tailoredResumes:hiddenIds");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("tailoredResumes:hiddenIds", JSON.stringify(hiddenIds));
  }, [hiddenIds]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const rows = await api.listTailoredResumes(200);
        setItems(Array.isArray(rows) ? rows : []);
      } catch (error) {
        console.error("Failed to load tailored resumes:", error);
        toast.error("Failed to load tailored resumes");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDownloadPdf = async (item: TailoredResumeListEntry) => {
    try {
      setDownloadingId(item.id);
      const blob = await api.downloadTailoredPdf(item.id);
      const baseName = (item.job_title || item.company || "tailored_resume").replace(/\s+/g, "_").toLowerCase();
      downloadBlob(blob, `${baseName}.pdf`);
    } catch (error) {
      console.error("Failed to download tailored resume PDF:", error);
      toast.error("Failed to download tailored resume PDF");
    } finally {
      setDownloadingId("");
    }
  };

  const handleHide = (id: string) => {
    setHiddenIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const handleOpenDetail = async (item: TailoredResumeListEntry) => {
    try {
      setLoadingDetailId(item.id);
      const next = await api.getTailoredResumeDetail(item.id);
      setDetail(next);
      setDetailOpen(true);
    } catch (error) {
      console.error("Failed to load tailored resume detail:", error);
      toast.error("Failed to load tailored resume details");
    } finally {
      setLoadingDetailId("");
    }
  };

  const handleDelete = async (item: TailoredResumeListEntry) => {
    if (!window.confirm(`Delete tailored resume for "${item.job_title || item.company || "this job"}"?`)) return;
    try {
      setDeletingId(item.id);
      await api.deleteTailoredResume(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setHiddenIds((current) => current.filter((id) => id !== item.id));
      toast.success("Tailored resume deleted");
    } catch (error) {
      console.error("Failed to delete tailored resume:", error);
      toast.error("Failed to delete tailored resume");
    } finally {
      setDeletingId("");
    }
  };

  const visibleItems = items.filter((item) => !hiddenIds.includes(item.id));
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / RESUMES_PER_PAGE));
  const pagedItems = visibleItems.slice((page - 1) * RESUMES_PER_PAGE, page * RESUMES_PER_PAGE);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-gray-500 dark:text-slate-400">Loading tailored resumes...</div>;
  }

  return (
    <div className="space-y-6">
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl dark:border-slate-800 dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle>{detail?.job_title || detail?.company || "Tailored resume"}</DialogTitle>
          </DialogHeader>

          {detail ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">User</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.username || user?.email || "Current user"}</div>
                  {user?.email ? <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{user.email}</div> : null}
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Job Target</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {detail.job_title || detail.company || "Tailored resume"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{[detail.company, detail.location].filter(Boolean).join(" • ") || "No extra job metadata"}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Skills</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{detail.selected_skill_count}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Evidence</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{detail.selected_item_count}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Created</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {detail.created_at ? new Date(detail.created_at).toLocaleString() : "Unknown"}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {detail.sections.map((section) => (
                  <div key={section.title} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900 dark:text-slate-100">{section.title}</div>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                      {section.lines.map((line, index) => (
                        <p key={`${section.title}:${index}`}>{line}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-6 py-7 md:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              Resume Library
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Tailored resumes attached to saved jobs</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              View every tailored resume you have generated and download the PDF associated with each job target.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        {hiddenIds.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setHiddenIds([])}>
            Show hidden resumes
          </Button>
        ) : null}
      </div>

      {visibleItems.length === 0 ? (
        <Card className="border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
          {items.length === 0
            ? "No tailored resumes yet. Generate one from Job Match to populate this page."
            : "All tailored resumes are currently hidden."}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {pagedItems.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer border-slate-200 p-3.5 transition-colors hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:bg-slate-900"
              onClick={() => handleOpenDetail(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpenDetail(item);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-blue-50 p-1.5 dark:bg-slate-800">
                      <FileText className="h-3.5 w-3.5 text-[#1E3A8A]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.job_title || item.company || "Tailored resume"}</h3>
                      <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                        {[item.company, item.location].filter(Boolean).join(" • ") || "Saved job target"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/80">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Skills</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.selected_skill_count}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/80">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Evidence</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.selected_item_count}</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/80">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Created</div>
                  <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Unknown"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  {item.job_id ? "Attached to a saved job analysis" : "Generated from standalone job text"}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleHide(item.id);
                    }}
                    disabled={deletingId === item.id}
                    className="h-8 px-2.5 text-xs"
                  >
                    <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                    Hide
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(item);
                    }}
                    disabled={deletingId === item.id}
                    className="h-8 px-2.5 text-xs text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {deletingId === item.id ? "Deleting..." : "Delete"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDownloadPdf(item);
                    }}
                    disabled={downloadingId === item.id || deletingId === item.id || loadingDetailId === item.id}
                    className={`h-8 px-2.5 text-xs ${activeHeaderTheme.buttonClass}`}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {downloadingId === item.id ? "Downloading..." : "Download PDF"}
                  </Button>
                </div>
              </div>
            </Card>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
