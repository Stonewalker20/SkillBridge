import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, ChevronDown, Image as ImageIcon, LifeBuoy, PlayCircle } from "lucide-react";
import { Link } from "react-router";
import { AccountSectionNav } from "../components/AccountSectionNav";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { useAuth } from "../context/AuthContext";
import { useAccountPreferences } from "../context/AccountPreferencesContext";
import { getHeaderThemeSoftPanelClass, useHeaderTheme } from "../lib/headerTheme";
import {
  getHelpWalkthroughSections,
  HELP_WALKTHROUGH_MEDIA_TIPS,
  type HelpWalkthroughSection,
} from "../lib/helpWalkthrough";

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

function CollapsibleGuideCard({
  section,
  defaultOpen = false,
  softPanelClass,
  accentTextClass,
}: {
  section: HelpWalkthroughSection;
  defaultOpen?: boolean;
  softPanelClass: string;
  accentTextClass: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = section.icon;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`rounded-2xl p-2.5 ${softPanelClass}`}>
              <Icon className={`h-5 w-5 ${accentTextClass}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{section.routeLabel}</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{section.summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-start">
            <Button asChild variant="outline" size="sm" className="dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
              <Link to={section.route}>
                Open
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="[&[data-state=open]>svg]:rotate-180">
                {open ? "Collapse" : "Expand"}
                <ChevronDown className="ml-2 h-4 w-4 transition-transform duration-200" />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">What to do</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">What you should see</p>
                <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{section.result}</p>
              </div>
            </div>
            <div className="grid gap-4">
              <MediaSlot kind="image" title="Image placeholder" label={section.imageLabel} hint={section.imageHint} />
              <MediaSlot kind="video" title="Short video placeholder" label={section.videoLabel} hint={section.videoHint} />
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function OverviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{title}</p>
      <div className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{children}</div>
    </div>
  );
}

export function AccountHelpGuide() {
  const { activeHeaderTheme } = useHeaderTheme();
  const { preferences } = useAccountPreferences();
  const { user } = useAuth();
  const isAdminUser = ["owner", "admin", "team"].includes(String(user?.role ?? "").toLowerCase());
  const sections = useMemo(() => getHelpWalkthroughSections(isAdminUser), [isAdminUser]);
  const softPanelClass = getHeaderThemeSoftPanelClass(activeHeaderTheme, preferences.panelStyle, preferences.gradientMode);

  return (
    <div className="max-w-6xl space-y-5">
      <AccountSectionNav />

      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-5 py-5 md:px-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                <BookOpen className="h-3.5 w-3.5" />
                Help Guide
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Walk through the website one page at a time.</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Every section starts collapsed so the guide stays easy to scan. Open only the page you need, then use the suggested screenshots and short clips to document the workflow.
              </p>
            </div>
            <Button asChild className={activeHeaderTheme.buttonClass}>
              <Link to="/app/account/help">
                Back to Help Requests
                <LifeBuoy className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="grid gap-4 md:grid-cols-2">
          <OverviewCard title="Start here">
            <ol className="space-y-2">
              <li>1. Open the dashboard and learn where your progress lives.</li>
              <li>2. Add evidence and confirm the skills it supports.</li>
              <li>3. Run a job match, review the score, then improve what is missing.</li>
            </ol>
          </OverviewCard>
          <OverviewCard title="Media tips">
            <ul className="space-y-2">
              {HELP_WALKTHROUGH_MEDIA_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </OverviewCard>
        </div>
      </Card>

      <div className="grid gap-4">
        {sections.map((section) => (
          <CollapsibleGuideCard
            key={section.key}
            section={section}
            softPanelClass={softPanelClass}
            accentTextClass={activeHeaderTheme.accentTextClass}
          />
        ))}
      </div>
    </div>
  );
}
