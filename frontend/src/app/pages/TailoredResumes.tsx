import { useEffect, useState } from "react";
import { api, type TailoredResumeDetail, type TailoredResumeListEntry } from "../services/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Briefcase, Download, EyeOff, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useAuth } from "../context/AuthContext";

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
  const [items, setItems] = useState<TailoredResumeListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [detail, setDetail] = useState<TailoredResumeDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState("");
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

  if (loading) {
    return <div className="flex h-full items-center justify-center text-gray-500">Loading tailored resumes...</div>;
  }

  return (
    <div className="space-y-6">
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.job_title || detail?.company || "Tailored resume"}</DialogTitle>
          </DialogHeader>

          {detail ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">User</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{user?.username || user?.email || "Current user"}</div>
                  {user?.email ? <div className="mt-1 text-sm text-slate-600">{user.email}</div> : null}
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Job Target</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {detail.job_title || detail.company || "Tailored resume"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{[detail.company, detail.location].filter(Boolean).join(" • ") || "No extra job metadata"}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Template</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 capitalize">{detail.template}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Skills</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{detail.selected_skill_count}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Evidence</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{detail.selected_item_count}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Created</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {detail.created_at ? new Date(detail.created_at).toLocaleString() : "Unknown"}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {detail.sections.map((section) => (
                  <div key={section.title} className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">{section.title}</div>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
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

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(30,58,138,0.16),_transparent_34%),linear-gradient(135deg,_#ffffff,_#f8fafc)]">
        <div className="px-6 py-7 md:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Resume Library
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Tailored resumes attached to saved jobs</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
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
        <Card className="border-slate-200 p-8 text-center text-sm text-slate-500">
          {items.length === 0
            ? "No tailored resumes yet. Generate one from Job Match to populate this page."
            : "All tailored resumes are currently hidden."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {visibleItems.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer border-slate-200 p-6 transition-colors hover:bg-slate-50/70"
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
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-blue-50 p-3">
                      <FileText className="h-5 w-5 text-[#1E3A8A]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{item.job_title || item.company || "Tailored resume"}</h3>
                      <p className="text-sm text-slate-600">
                        {[item.company, item.location].filter(Boolean).join(" • ") || "Saved job target"}
                      </p>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {item.template}
                </Badge>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Skills</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{item.selected_skill_count}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Evidence</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{item.selected_item_count}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Created</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Unknown"}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Briefcase className="h-4 w-4" />
                  {item.job_id ? "Attached to a saved job analysis" : "Generated from standalone job text"}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleHide(item.id)}
                    type="button"
                    onClickCapture={(event) => event.stopPropagation()}
                    disabled={deletingId === item.id}
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    Hide
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClickCapture={(event) => event.stopPropagation()}
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deletingId === item.id ? "Deleting..." : "Delete"}
                  </Button>
                  <Button
                    type="button"
                    onClickCapture={(event) => event.stopPropagation()}
                    onClick={() => handleDownloadPdf(item)}
                    disabled={downloadingId === item.id || deletingId === item.id || loadingDetailId === item.id}
                    className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {downloadingId === item.id ? "Downloading..." : "Download PDF"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
