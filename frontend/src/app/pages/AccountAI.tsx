import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Cpu, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { api, type AISettingsDetail, type BillingPlan } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { useAccountPreferences } from "../context/AccountPreferencesContext";
import { getHeaderThemeSoftPanelClass, useHeaderTheme } from "../lib/headerTheme";
import { AccountSectionNav } from "../components/AccountSectionNav";
import { SubscriptionGate } from "../components/SubscriptionGate";

const DEFAULT_BILLING_PLANS: BillingPlan[] = [
  {
    key: "starter",
    label: "Starter",
    price_monthly: 9,
    price_display: "$9/mo",
    description: "Core workflow access for evidence, skills, jobs, and tailored resumes.",
    features: ["Core workflow access", "Standard customization", "Profile image upload"],
    recommended: false,
    checkout_available: false,
  },
  {
    key: "pro",
    label: "Pro",
    price_monthly: 19,
    price_display: "$19/mo",
    description: "Best all-around tier for active job seekers and regular platform use.",
    features: ["Everything in Starter", "Priority billing support", "Best value for most users"],
    recommended: true,
    checkout_available: false,
  },
  {
    key: "elite",
    label: "Elite",
    price_monthly: 39,
    price_display: "$39/mo",
    description: "Highest tier for heavy usage and the strongest support priority.",
    features: ["Everything in Pro", "Highest-priority support", "Best fit for weekly power usage"],
    recommended: false,
    checkout_available: false,
  },
];

export function AccountAI() {
  const { refreshUser } = useAuth();
  const { recordActivity } = useActivity();
  const { activeHeaderTheme } = useHeaderTheme();
  const { preferences } = useAccountPreferences();
  const softPanelClass = getHeaderThemeSoftPanelClass(activeHeaderTheme, preferences.panelStyle, preferences.gradientMode);

  const [loading, setLoading] = useState(true);
  const [savingAI, setSavingAI] = useState(false);
  const [startingBilling, setStartingBilling] = useState(false);
  const [usingDevFallback, setUsingDevFallback] = useState(false);
  const [accountRole, setAccountRole] = useState("user");
  const [subscriptionStatus, setSubscriptionStatus] = useState("inactive");
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [subscriptionRenewalAt, setSubscriptionRenewalAt] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [billingStatus, setBillingStatus] = useState<any>(null);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState<AISettingsDetail | null>(null);

  const billingPlans = useMemo(() => {
    const plans = Array.isArray(billingStatus?.plans) && billingStatus.plans.length ? billingStatus.plans : DEFAULT_BILLING_PLANS;
    return plans.map((plan) => ({
      ...plan,
      checkout_available: plan.checkout_available || billingStatus?.mode === "mock",
    }));
  }, [billingStatus]);
  const selectedPlanMeta = useMemo(
    () => billingPlans.find((plan) => plan.key === selectedPlan) ?? billingPlans.find((plan) => plan.recommended) ?? billingPlans[0],
    [billingPlans, selectedPlan]
  );
  const isAdminRole = ["owner", "admin", "team"].includes(String(accountRole).toLowerCase());
  const hasSubscriptionAccess = isAdminRole || subscriptionStatus === "active";

  const loadPageState = async () => {
    const [me, billing] = await Promise.all([api.me(), api.getBillingStatus().catch(() => null)]);
    setAccountRole(me?.role || "user");
    setSubscriptionStatus(me?.subscription_status || "inactive");
    setSubscriptionPlan(me?.subscription_plan || null);
    setSubscriptionRenewalAt(me?.subscription_renewal_at || null);
    setBillingStatus(billing);
    setBillingMessage(billing?.message ?? null);
    setSelectedPlan(me?.subscription_plan || billing?.current_plan || billing?.plans?.find((plan: BillingPlan) => plan.recommended)?.key || "pro");

    const hasAccess =
      ["owner", "admin", "team"].includes(String(me?.role ?? "").toLowerCase()) ||
      String(me?.subscription_status ?? "").toLowerCase() === "active";
    setAiSettings(hasAccess ? await api.getAIPreferences().catch(() => null) : null);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await loadPageState();
      } catch (e: any) {
        toast.error(e?.message || "Failed to load AI settings");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleStartCheckout = async (planOverride?: string) => {
    const plan = planOverride || selectedPlan || "pro";
    setStartingBilling(true);
    setBillingMessage(null);
    try {
      const session = await api.createBillingCheckout(plan);
      setBillingStatus((current: any) => (current ? { ...current, ...session } : session));
      setBillingMessage(session.message ?? null);
      if (session.status === "created" && session.checkout_url) {
        window.location.assign(session.checkout_url);
        return;
      }
      if (session.status === "already_active") {
        toast.success("Subscription already active");
        await loadPageState();
        await refreshUser();
        return;
      }
      toast.error(session.message || "Checkout is not available yet");
    } catch (e: any) {
      const message = e?.message || "Failed to start checkout";
      setBillingMessage(message);
      toast.error(message);
    } finally {
      setStartingBilling(false);
    }
  };

  const handleUseDevFallback = async (planOverride?: string) => {
    const plan = planOverride || selectedPlan || "pro";
    setUsingDevFallback(true);
    setBillingMessage(null);
    try {
      await api.activateSubscription(plan);
      await loadPageState();
      await refreshUser();
      recordActivity({
        id: `account:subscription:${Date.now()}`,
        type: "account",
        action: "activated",
        name: `${plan} subscription activated`,
      });
      toast.success("Development fallback activated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to activate the development fallback");
    } finally {
      setUsingDevFallback(false);
    }
  };

  const handleSaveAISettings = async () => {
    if (!aiSettings?.preferences) return;
    setSavingAI(true);
    try {
      const updated = await api.updateAIPreferences({
        inference_mode: aiSettings.preferences.inference_mode,
        embedding_model: aiSettings.preferences.embedding_model,
        zero_shot_model: aiSettings.preferences.zero_shot_model,
      });
      setAiSettings(updated);
      recordActivity({
        id: `account:ai:${Date.now()}`,
        type: "account",
        action: "updated",
        name: "AI model settings updated",
      });
      toast.success("AI settings updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update AI settings");
    } finally {
      setSavingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl space-y-5">
        <AccountSectionNav />
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-gray-500 dark:text-slate-400">Loading AI settings...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-5">
      <AccountSectionNav />

      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-5 py-5 md:px-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                AI Settings
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Model and runtime controls</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                Choose how evidence analysis, embeddings, and zero-shot inference run for your account.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Runtime</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{aiSettings?.provider_mode ?? "Unavailable"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Plan</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{subscriptionPlan || (isAdminRole ? "Included" : "Inactive")}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Access</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{hasSubscriptionAccess ? "Unlocked" : "Subscription required"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SubscriptionGate
        active={hasSubscriptionAccess}
        plan={subscriptionPlan}
        renewalAt={subscriptionRenewalAt}
        role={accountRole}
        compact
        onActivate={hasSubscriptionAccess ? undefined : () => handleStartCheckout(selectedPlanMeta?.key)}
        activating={startingBilling}
        ctaLabel={selectedPlanMeta ? `Choose ${selectedPlanMeta.label}` : "Start checkout"}
        secondaryAction={billingStatus?.dev_fallback_available && !hasSubscriptionAccess ? () => handleUseDevFallback(selectedPlanMeta?.key) : undefined}
        secondaryActionLabel="Use dev fallback"
        statusMessage={billingMessage || billingStatus?.message || undefined}
      />

      <Card className="border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4 flex items-center gap-3">
          <div className={`rounded-2xl p-2 ${softPanelClass}`}>
            <Sparkles className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">AI Configuration</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Adjust inference behavior for future skill extraction, semantic search, and matching.
            </p>
          </div>
        </div>

        {hasSubscriptionAccess ? (
          aiSettings ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">Inference Mode</p>
                  <Select
                    value={aiSettings.preferences.inference_mode ?? "auto"}
                    onValueChange={(value) =>
                      setAiSettings((current) =>
                        current ? { ...current, preferences: { ...current.preferences, inference_mode: value } } : current
                      )
                    }
                  >
                    <SelectTrigger className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                      <SelectValue placeholder="Select inference mode" />
                    </SelectTrigger>
                    <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      {aiSettings.preferences.available_inference_modes.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">Embedding Model</p>
                  <Select
                    value={aiSettings.preferences.embedding_model ?? ""}
                    onValueChange={(value) =>
                      setAiSettings((current) =>
                        current ? { ...current, preferences: { ...current.preferences, embedding_model: value } } : current
                      )
                    }
                  >
                    <SelectTrigger className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                      <SelectValue placeholder="Select embedding model" />
                    </SelectTrigger>
                    <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      {aiSettings.preferences.available_embedding_models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">Zero-Shot Model</p>
                  <Select
                    value={aiSettings.preferences.zero_shot_model ?? ""}
                    onValueChange={(value) =>
                      setAiSettings((current) =>
                        current ? { ...current, preferences: { ...current.preferences, zero_shot_model: value } } : current
                      )
                    }
                  >
                    <SelectTrigger className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                      <SelectValue placeholder="Select zero-shot model" />
                    </SelectTrigger>
                    <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      {aiSettings.preferences.available_zero_shot_models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Embeddings Provider</p>
                  <p className="mt-2 font-medium text-slate-900 dark:text-slate-100">{aiSettings.embeddings_provider || "Unavailable"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 md:col-span-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Guidance</p>
                  <p className="mt-2">
                    Switch to `local-fallback` if you want faster, lighter analysis without transformer loading. Keep stronger models selected when you want higher-quality semantic retrieval.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  <span>Changes apply to future analysis and matching runs.</span>
                </div>
                <Button onClick={handleSaveAISettings} disabled={savingAI} className={activeHeaderTheme.buttonClass}>
                  {savingAI ? "Saving..." : "Save AI Settings"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600 dark:text-slate-300">AI settings are unavailable right now.</p>
          )
        ) : (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>AI settings unlock after your subscription is active.</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => handleStartCheckout(selectedPlanMeta?.key)} disabled={startingBilling} className={activeHeaderTheme.buttonClass}>
                {startingBilling ? "Starting checkout..." : `Checkout ${selectedPlanMeta?.label ?? "plan"}`}
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/account">Open billing page</Link>
              </Button>
              {billingStatus?.dev_fallback_available ? (
                <Button variant="outline" onClick={() => handleUseDevFallback(selectedPlanMeta?.key)} disabled={usingDevFallback}>
                  {usingDevFallback ? "Applying fallback..." : "Use dev fallback"}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
