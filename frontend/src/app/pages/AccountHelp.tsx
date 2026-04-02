import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  LifeBuoy,
  PlayCircle,
  Send,
  ShieldCheck,
  SlidersHorizontal,
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

type WalkthroughSection = {
  key: string;
  title: string;
  summary: string;
  route: string;
  routeLabel: string;
  steps: string[];
  result: string;
  imageLabel: string;
  videoLabel: string;
  imageHint: string;
  videoHint: string;
  icon: LucideIcon;
};

function MediaSlot({
  kind,
  title,
  hint,
  label,
  source,
}: {
  kind: "image" | "video";
  title: string;
  hint: string;
  label: string;
  source?: string | null;
}) {
  const Icon = kind === "image" ? ImageIcon : PlayCircle;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-950/60">
      {source ? (
        kind === "image" ? (
          <img src={source} alt={title} className="h-40 w-full object-cover" />
        ) : (
          <video className="h-40 w-full object-cover" controls playsInline preload="metadata" src={source} />
        )
      ) : (
        <div className="flex h-40 items-center justify-center bg-[linear-gradient(135deg,_rgba(15,23,42,0.95),_rgba(15,118,110,0.75))] px-4 text-center text-white dark:bg-[linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(30,64,175,0.7))]">
          <div>
            <Icon className="mx-auto h-8 w-8 text-white/85" />
            <div className="mt-3 text-sm font-semibold">{label}</div>
            <p className="mt-1 text-xs leading-5 text-white/80">{hint}</p>
          </div>
        </div>
      )}
      <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {kind === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
          {title}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{hint}</p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{source ? `Using ${source}` : `Suggested file: ${label}`}</p>
      </div>
    </div>
  );
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
  const walkthroughSections = useMemo<WalkthroughSection[]>(
    () => [
      {
        key: "dashboard",
        title: "Dashboard",
        summary: "Start here to see your progress, next actions, and recent activity at a glance.",
        route: "/app/dashboard",
        routeLabel: "Open Dashboard",
        steps: ["Check the top skills and recent projects.", "Use the next achievement card to decide what to do next.", "Follow the quick links when you want to jump into a task."],
        result: "You always know what to work on next.",
        imageLabel: "Dashboard screenshot",
        videoLabel: "Dashboard walkthrough",
        imageHint: "Show the summary cards, top skills, and the next step the user should take.",
        videoHint: "A 5 to 10 second clip showing the dashboard and one quick click into a task.",
        icon: LayoutDashboard,
      },
      {
        key: "skills",
        title: "Skills",
        summary: "Keep your skills up to date, confirm what you know, and review which skills need more proof.",
        route: "/app/skills",
        routeLabel: "Open Skills",
        steps: ["Confirm a skill you already know.", "Raise or lower proficiency after reviewing the evidence.", "Use the hover details to see what proof supports each score."],
        result: "Your profile shows a clearer picture of what you can do.",
        imageLabel: "Skills screenshot",
        videoLabel: "Skills walkthrough",
        imageHint: "Show the skill cards, proficiency dots, and evidence hover panel.",
        videoHint: "A short clip of confirming a skill and changing its proficiency.",
        icon: BookOpen,
      },
      {
        key: "evidence",
        title: "Evidence",
        summary: "Add screenshots, notes, links, or project proof so your skills are backed by real examples.",
        route: "/app/evidence",
        routeLabel: "Open Evidence",
        steps: ["Add a new proof item.", "Attach it to the right skills and project.", "Keep the text short and clear so it is easy to review later."],
        result: "Your proof becomes easier to find and easier to use.",
        imageLabel: "Evidence screenshot",
        videoLabel: "Evidence walkthrough",
        imageHint: "Show the evidence card layout and the add/edit flow.",
        videoHint: "A short clip of adding a proof item and connecting it to skills.",
        icon: ImageIcon,
      },
      {
        key: "jobs",
        title: "Job Match",
        summary: "Paste a job post to see how well it fits your skills, what is missing, and what to improve.",
        route: "/app/jobs",
        routeLabel: "Open Jobs",
        steps: ["Paste the full job description.", "Read the score breakdown and the plain-language match notes.", "Use the missing-skill buttons to improve your profile and rerun the score."],
        result: "You can compare yourself to the job in simple terms.",
        imageLabel: "Job match screenshot",
        videoLabel: "Job match walkthrough",
        imageHint: "Show the score, breakdown, missing skills, and match notes.",
        videoHint: "A short clip of running a job match and reading the result.",
        icon: ShieldCheck,
      },
      {
        key: "analytics",
        title: "Analytics",
        summary: "Use analytics to see your learning path, career paths, and where your profile is growing.",
        route: "/app/analytics",
        routeLabel: "Open Analytics",
        steps: ["Review your strongest skills.", "Open a learning path to see what to improve next.", "Check career paths to see which roles fit your current profile."],
        result: "You get a simple view of where to focus next.",
        imageLabel: "Analytics screenshot",
        videoLabel: "Analytics walkthrough",
        imageHint: "Show charts, learning path cards, and career path options.",
        videoHint: "A short clip of opening analytics and moving through one path.",
        icon: BarChart3,
      },
      {
        key: "personalization",
        title: "Account Settings",
        summary: "Personalize your workspace, profile image, and AI settings so the app feels like yours.",
        route: "/app/account",
        routeLabel: "Open Account",
        steps: ["Update your profile and workspace preferences.", "Adjust AI settings if you are a subscriber or admin.", "Use achievements and personalization to make the workspace easier to scan."],
        result: "The app matches your workflow and style.",
        imageLabel: "Account settings screenshot",
        videoLabel: "Account settings walkthrough",
        imageHint: "Show the account settings cards and a visible setting being changed.",
        videoHint: "A short clip of opening account settings and changing one preference.",
        icon: SlidersHorizontal,
      },
      {
        key: "support",
        title: "Help",
        summary: "Ask for help, check your past requests, and read admin responses in one place.",
        route: "/app/account/help",
        routeLabel: "Open Help",
        steps: ["Choose the right help category.", "Describe what you were trying to do and where you got stuck.", "Check back here for the admin reply and mark it as read."],
        result: "You can get answers without leaving the app.",
        imageLabel: "Help screenshot",
        videoLabel: "Help walkthrough",
        imageHint: "Show the request form and the list of previous requests.",
        videoHint: "A short clip of submitting a request and opening the response.",
        icon: LifeBuoy,
      },
      ...(isAdminUser
        ? [
            {
              key: "admin",
              title: "Admin Review",
              summary: "Admins can review users, skills, jobs, and help requests from the admin workspace.",
              route: "/app/admin",
              routeLabel: "Open Admin",
              steps: ["Review submitted jobs before they become public.", "Check skills and remove bad or duplicate entries.", "Answer help requests and keep the platform clean."],
              result: "Admin-only tools stay separate from normal user workflows.",
              imageLabel: "Admin screenshot",
              videoLabel: "Admin walkthrough",
              imageHint: "Show the admin workspace, skill review, or job moderation table.",
              videoHint: "A short clip of reviewing one item and saving the change.",
              icon: ShieldCheck,
            },
          ]
        : []),
    ],
    [isAdminUser]
  );

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
        <div className="flex items-center gap-2">
          <BookOpen className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Website walkthrough</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Use this guide to move through SkillBridge in a simple order. Each section leaves space for a screenshot and a short clip so the instructions stay easy to follow.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Start here</p>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
              <li>1. Open the dashboard and learn where your progress lives.</li>
              <li>2. Add evidence and confirm the skills it supports.</li>
              <li>3. Run a job match, review the score, then improve what is missing.</li>
            </ol>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Media tips</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
              <li>Use one clear screenshot for the page and one short 5 to 10 second clip for the action.</li>
              <li>Keep clips focused on one task, like confirming a skill or submitting help.</li>
              <li>Good filenames: `dashboard-walkthrough.png`, `skills-demo.mp4`, `help-response.mp4`.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {walkthroughSections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.key} className="overflow-hidden rounded-3xl border border-slate-200 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
                <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
                  <div className="p-5 md:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-2xl p-3 ${activeHeaderTheme.softPanelClass}`}>
                          <Icon className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {section.routeLabel}
                          </div>
                          <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{section.title}</h3>
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm" className="shrink-0 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                        <Link to={section.route}>
                          Open
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{section.summary}</p>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">What to do</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                          {section.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">What you should see</p>
                        <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{section.result}</p>
                        <Button asChild size="sm" variant="ghost" className="mt-3 h-8 px-2 text-slate-700 dark:text-slate-200">
                          <Link to={section.route}>
                            Go now
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 border-t border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/30 lg:border-l lg:border-t-0 md:p-6">
                    <MediaSlot
                      kind="image"
                      title="Image placeholder"
                      label={section.imageLabel}
                      hint={section.imageHint}
                    />
                    <MediaSlot
                      kind="video"
                      title="Short video placeholder"
                      label={section.videoLabel}
                      hint={section.videoHint}
                    />
                  </div>
                </div>
              </div>
            );
          })}
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
