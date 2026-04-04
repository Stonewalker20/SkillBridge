import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { BellRing, CheckCircle2, LifeBuoy, Rocket, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useHeaderTheme } from "../lib/headerTheme";
import { GET_STARTED_STEPS, getGetStartedGuidance, getStepByKey } from "../lib/getStarted";
import { api } from "../services/api";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "./ui/sheet";

const AUTO_OPEN_KEY_PREFIX = "getStartedAgent:autoOpened:";

export function GetStartedAgent() {
  const location = useLocation();
  const { user, refreshUser } = useAuth();
  const { activeHeaderTheme } = useHeaderTheme();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const completedSteps = useMemo(
    () => new Set((user?.onboarding?.completed_steps ?? []).map((value) => String(value || "").trim()).filter(Boolean)),
    [user?.onboarding?.completed_steps]
  );
  const nextStep = useMemo(
    () => GET_STARTED_STEPS.find((step) => !completedSteps.has(step.key)) ?? null,
    [completedSteps]
  );
  const progressPct = GET_STARTED_STEPS.length ? Math.round((completedSteps.size / GET_STARTED_STEPS.length) * 100) : 0;
  const routeGuidance = useMemo(() => getGetStartedGuidance(location.pathname), [location.pathname]);
  const guidedStep = useMemo(() => getStepByKey(routeGuidance?.stepKey), [routeGuidance?.stepKey]);
  const unreadHelpCount = Math.max(0, Number(user?.help_unread_response_count ?? 0) || 0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user?.id || !user?.is_new_user) return;
    const storageKey = `${AUTO_OPEN_KEY_PREFIX}${user.id}`;
    if (window.localStorage.getItem(storageKey)) return;
    setOpen(true);
    window.localStorage.setItem(storageKey, "1");
  }, [user?.id, user?.is_new_user]);

  if (!user?.is_new_user) return null;

  const updateGuideState = async (payload: Parameters<typeof api.updateMyOnboarding>[0]) => {
    setSaving(true);
    try {
      await api.updateMyOnboarding(payload);
      await refreshUser();
    } finally {
      setSaving(false);
    }
  };

  const markStepComplete = async (stepKey: string) => {
    const nextCompleted = Array.from(new Set([...completedSteps, stepKey]));
    const payload: Parameters<typeof api.updateMyOnboarding>[0] = {
      completed_steps: nextCompleted,
      last_step: stepKey,
    };
    if (nextCompleted.length >= GET_STARTED_STEPS.length) {
      payload.completed_at = new Date().toISOString();
    }
    try {
      await updateGuideState(payload);
      if (nextCompleted.length >= GET_STARTED_STEPS.length) {
        setOpen(false);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update onboarding progress");
    }
  };

  const rememberCurrentStep = (stepKey: string) => {
    void api
      .updateMyOnboarding({ last_step: stepKey })
      .then(() => refreshUser())
      .catch(() => {
        // Navigation should not be blocked if this passive update fails.
      });
  };

  const dismissGuide = async () => {
    try {
      await updateGuideState({ dismissed_at: new Date().toISOString() });
      setOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to hide the onboarding agent");
    }
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-30 sm:bottom-6 sm:right-6">
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className={`relative rounded-full px-4 py-6 shadow-lg ${activeHeaderTheme.buttonClass}`}
        >
          <Rocket className="mr-2 h-4 w-4" />
          Get Started
          {unreadHelpCount > 0 ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
              {unreadHelpCount}
            </span>
          ) : null}
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[92vw] border-slate-200 bg-white p-0 dark:border-slate-800 dark:bg-slate-950 sm:max-w-xl">
          <SheetHeader className={`border-b border-slate-200 px-6 py-5 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
            <div className="flex items-start justify-between gap-3 pr-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Onboarding Agent
                </div>
                <SheetTitle className="mt-4 text-left text-2xl text-slate-900 dark:text-slate-100">
                  Guided setup for new users
                </SheetTitle>
                <SheetDescription className="mt-2 text-left text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Use this assistant to move through the core SkillBridge workflow in the right order instead of guessing what page to use next.
                </SheetDescription>
              </div>
              <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                {completedSteps.size}/{GET_STARTED_STEPS.length}
              </Badge>
            </div>
            <div className="mt-4 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700">
              <div className={`h-2.5 rounded-full ${activeHeaderTheme.barClass}`} style={{ width: `${Math.max(8, progressPct)}%` }} />
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {routeGuidance && guidedStep ? (
              <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-white p-2 text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    <guidedStep.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Guidance for this page
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">{routeGuidance.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{routeGuidance.body}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{routeGuidance.hint}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm" className={activeHeaderTheme.buttonClass}>
                        <Link
                          to={routeGuidance.href}
                          onClick={() => {
                            rememberCurrentStep(routeGuidance.stepKey);
                            setOpen(false);
                          }}
                        >
                          {routeGuidance.cta}
                        </Link>
                      </Button>
                      {!completedSteps.has(routeGuidance.stepKey) ? (
                        <Button size="sm" variant="outline" onClick={() => void markStepComplete(routeGuidance.stepKey)} disabled={saving}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark this step done
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {unreadHelpCount > 0 ? (
              <section className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900 dark:bg-rose-950/20">
                <div className="flex items-start gap-3">
                  <BellRing className="mt-0.5 h-4 w-4 text-rose-600 dark:text-rose-300" />
                  <div>
                    <div className="text-sm font-semibold text-rose-700 dark:text-rose-200">
                      You have {unreadHelpCount === 1 ? "a help response" : `${unreadHelpCount} help responses`} waiting
                    </div>
                    <p className="mt-1 text-sm text-rose-700/90 dark:text-rose-200/90">
                      Open your help requests to read the admin response and mark it as read.
                    </p>
                    <Button asChild size="sm" variant="outline" className="mt-3 border-rose-300 bg-white text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                      <Link to="/app/account/help" onClick={() => setOpen(false)}>
                        Open help requests
                      </Link>
                    </Button>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Full setup path
              </div>
              {GET_STARTED_STEPS.map((step, index) => {
                const complete = completedSteps.has(step.key);
                const isNext = nextStep?.key === step.key;
                return (
                  <div
                    key={step.key}
                    className={`rounded-2xl border p-4 ${
                      complete
                        ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                        : isNext
                          ? "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/50"
                          : "border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-950/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`rounded-xl p-2 ${complete ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                        <step.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {index + 1}. {step.title}
                          </div>
                          {complete ? (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Done
                            </Badge>
                          ) : isNext ? (
                            <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                              Next
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            asChild
                            size="sm"
                            variant={isNext ? "default" : "outline"}
                            className={isNext ? activeHeaderTheme.buttonClass : undefined}
                          >
                            <Link
                              to={step.href}
                              onClick={() => {
                                rememberCurrentStep(step.key);
                                setOpen(false);
                              }}
                            >
                              {step.cta}
                            </Link>
                          </Button>
                          {!complete ? (
                            <Button size="sm" variant="ghost" onClick={() => void markStepComplete(step.key)} disabled={saving}>
                              Mark complete
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>

          <SheetFooter className="border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <LifeBuoy className="h-4 w-4" />
                If you get stuck, send a request from the help page.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/account/help?category=onboarding" onClick={() => setOpen(false)}>
                    Open help
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void dismissGuide()} disabled={saving}>
                  Hide guide
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
