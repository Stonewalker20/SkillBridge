import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BellRing,
  HelpCircle,
  LifeBuoy,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation, useSearchParams } from "react-router";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api, type HelpRequest } from "../services/api";
import { AccountSectionNav } from "../components/AccountSectionNav";
import { useAuth } from "../context/AuthContext";
import { useHeaderTheme } from "../lib/headerTheme";
import { getHelpWalkthroughSections } from "../lib/helpWalkthrough";

const HELP_CATEGORIES = [
  { value: "onboarding", label: "Getting started" },
  { value: "skills", label: "Skills" },
  { value: "evidence", label: "Evidence" },
  { value: "jobs", label: "Job match" },
  { value: "resumes", label: "Tailored resumes" },
  { value: "analytics", label: "Analytics" },
  { value: "billing", label: "Billing" },
  { value: "bug", label: "Bug report" },
  { value: "other", label: "Other" },
] as const;

function statusBadgeClass(status: string): string {
  switch (String(status || "").toLowerCase()) {
    case "resolved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300";
    case "in_review":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300";
  }
}

export function AccountHelp() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { activeHeaderTheme } = useHeaderTheme();
  const { user, refreshUser } = useAuth();
  const isAdminUser = ["owner", "admin", "team"].includes(String(user?.role ?? "").toLowerCase());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState("");
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [category, setCategory] = useState<string>("onboarding");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const currentPage = useMemo(() => location.pathname, [location.pathname]);
  const unreadResponses = requests.filter((entry) => entry.user_has_unread_response).length;
  const walkthroughCount = useMemo(() => getHelpWalkthroughSections(isAdminUser).length, [isAdminUser]);

  useEffect(() => {
    const requestedCategory = String(searchParams.get("category") || "").trim().toLowerCase();
    if (HELP_CATEGORIES.some((option) => option.value === requestedCategory)) {
      setCategory(requestedCategory);
    }
  }, [searchParams]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      setRequests(await api.listMyHelpRequests());
    } catch (error: any) {
      toast.error(error?.message || "Failed to load help requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handleSubmit = async () => {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (trimmedSubject.length < 4) {
      toast.error("Add a short subject so we know what you need.");
      return;
    }
    if (trimmedMessage.length < 20) {
      toast.error("Add a bit more detail so the request can be reviewed properly.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.submitHelpRequest({
        category,
        subject: trimmedSubject,
        message: trimmedMessage,
        page: currentPage,
      });
      setRequests((current) => [created, ...current]);
      setSubject("");
      setMessage("");
      setCategory("onboarding");
      toast.success("Help request submitted");
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit help request");
    } finally {
      setSubmitting(false);
    }
  };

  const acknowledgeResponse = async (requestId: string) => {
    setAcknowledgingId(requestId);
    try {
      const updated = await api.acknowledgeHelpRequestResponse(requestId);
      setRequests((current) => current.map((entry) => (entry.id === requestId ? updated : entry)));
      await refreshUser();
      toast.success("Marked response as read");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update response status");
    } finally {
      setAcknowledgingId("");
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <AccountSectionNav />

      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-6 py-6 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                <LifeBuoy className="h-3.5 w-3.5" />
                Help
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Ask for help or report friction.</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Submit support requests here when you hit a blocker, need clarification, or want help getting through the workflow.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Requests</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{requests.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Open</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {requests.filter((entry) => entry.status === "open").length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Responses waiting</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {Math.max(unreadResponses, Number(user?.help_unread_response_count ?? 0) || 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70 col-span-2 sm:col-span-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Current page</p>
                <p className="mt-2 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{currentPage}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
              <LifeBuoy className="h-3.5 w-3.5" />
              Help Guide
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Need the full walkthrough?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              The page-by-page guide now lives on its own Help subpage so requests and replies stay easier to scan here.
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {walkthroughCount} guide sections are available there, and they all start collapsed by default.
            </p>
          </div>
          <Button asChild className={activeHeaderTheme.buttonClass}>
            <Link to="/app/account/help/walkthrough">
              Open walkthrough
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <HelpCircle className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Submit a request</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Include the workflow you were in and what you expected to happen. The current page is attached automatically.
          </p>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="help-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="help-category" className="dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                  {HELP_CATEGORIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="help-subject">Subject</Label>
              <Input
                id="help-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Example: I’m not sure what to do after uploading evidence"
                className="dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="help-message">Message</Label>
              <Textarea
                id="help-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Describe what you were trying to do, what you expected, and what blocked you."
                rows={8}
                className="resize-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300">
              This request will be tagged to <span className="font-medium text-slate-900 dark:text-slate-100">{currentPage}</span>.
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className={activeHeaderTheme.buttonClass}>
              <Send className="mr-2 h-4 w-4" />
              {submitting ? "Submitting..." : "Submit help request"}
            </Button>
          </div>
        </Card>

        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Your recent requests</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Track what you asked for and whether it is still open.</p>
            </div>
            <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
              {requests.length} total
            </Badge>
          </div>

          {loading ? (
            <div className="mt-5 text-sm text-slate-600 dark:text-slate-300">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
              No help requests yet.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {requests.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.subject}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {entry.category} {entry.page ? `• ${entry.page}` : ""} {entry.created_at ? `• ${new Date(entry.created_at).toLocaleString()}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {entry.user_has_unread_response ? (
                        <Badge className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
                          <BellRing className="h-3 w-3" />
                          Response waiting
                        </Badge>
                      ) : null}
                      <Badge className={statusBadgeClass(entry.status)}>{entry.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{entry.message}</p>
                  {entry.admin_response ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Admin response</div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{entry.admin_response}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {entry.admin_responded_at ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Responded {new Date(entry.admin_responded_at).toLocaleString()}
                          </span>
                        ) : null}
                        {entry.user_has_unread_response ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeResponse(entry.id)}
                            disabled={acknowledgingId === entry.id}
                            className="dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Mark response as read
                          </Button>
                        ) : entry.user_acknowledged_response_at ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Read {new Date(entry.user_acknowledged_response_at).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
