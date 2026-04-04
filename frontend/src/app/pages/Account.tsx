import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Award, Lock, Mail, Settings2, Trash2, User, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { api, type BillingPlan } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { useHeaderTheme } from "../lib/headerTheme";
import { avatarPresetClass } from "../lib/avatarPresets";
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

export function Account() {
  const { refreshUser } = useAuth();
  const { recordActivity } = useActivity();
  const { activeHeaderTheme } = useHeaderTheme();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [startingBilling, setStartingBilling] = useState(false);
  const [openingBillingPortal, setOpeningBillingPortal] = useState(false);
  const [usingDevFallback, setUsingDevFallback] = useState(false);
  const [billingStatus, setBillingStatus] = useState<any>(null);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [accountRole, setAccountRole] = useState("user");
  const [subscriptionStatus, setSubscriptionStatus] = useState("inactive");
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [subscriptionRenewalAt, setSubscriptionRenewalAt] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreset, setAvatarPreset] = useState<string | null>("midnight");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [me, billing] = await Promise.all([
          api.me(),
          api.getBillingStatus().catch(() => null),
        ]);
        setUsername(me?.username || "");
        setEmail(me?.email || "");
        setAccountRole(me?.role || "user");
        setSubscriptionStatus(me?.subscription_status || "inactive");
        setSubscriptionPlan(me?.subscription_plan || null);
        setSubscriptionRenewalAt(me?.subscription_renewal_at || null);
        setAvatarUrl(me?.avatar_url || null);
        setAvatarPreset(me?.avatar_preset || "midnight");
        setBillingStatus(billing);
        setBillingMessage(billing?.message ?? null);
        setSelectedPlan(me?.subscription_plan || billing?.current_plan || billing?.plans?.find((plan: BillingPlan) => plan.recommended)?.key || "pro");
      } catch (e: any) {
        toast.error(e?.message || "Failed to load account");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const initials = useMemo(() => {
    const raw = (username || "").trim();
    if (!raw) return "SB";
    const parts = raw.split(/[\s._-]+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "S";
    const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "B";
    return (a + b).toUpperCase();
  }, [username]);

  const isAdminRole = ["owner", "admin", "team"].includes(String(accountRole).toLowerCase());
  const hasSubscriptionAccess = isAdminRole || subscriptionStatus === "active";
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

  const refreshBillingState = async () => {
    const [me, billing] = await Promise.all([
      api.me(),
      api.getBillingStatus().catch(() => null),
    ]);
    setUsername(me?.username || "");
    setEmail(me?.email || "");
    setAccountRole(me?.role || "user");
    setSubscriptionStatus(me?.subscription_status || "inactive");
    setSubscriptionPlan(me?.subscription_plan || null);
    setSubscriptionRenewalAt(me?.subscription_renewal_at || null);
    setBillingStatus(billing);
    setBillingMessage(billing?.message ?? null);
    setSelectedPlan(me?.subscription_plan || billing?.current_plan || billing?.plans?.find((plan: BillingPlan) => plan.recommended)?.key || "pro");
  };

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
        await refreshBillingState();
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

  const handleOpenBillingPortal = async () => {
    setOpeningBillingPortal(true);
    setBillingMessage(null);
    try {
      const portal = await api.createBillingPortal();
      setBillingMessage(portal.message ?? null);
      if (portal.status === "created" && portal.portal_url) {
        window.location.assign(portal.portal_url);
        return;
      }
      toast.error(portal.message || "Billing portal is not available");
    } catch (e: any) {
      const message = e?.message || "Failed to open billing portal";
      setBillingMessage(message);
      toast.error(message);
    } finally {
      setOpeningBillingPortal(false);
    }
  };

  const handleUseDevFallback = async (planOverride?: string) => {
    const plan = planOverride || selectedPlan || "pro";
    setUsingDevFallback(true);
    setBillingMessage(null);
    try {
      const updated = await api.activateSubscription(plan);
      setSubscriptionStatus(updated.subscription_status || "active");
      setSubscriptionPlan(updated.subscription_plan || plan);
      setSubscriptionRenewalAt(updated.subscription_renewal_at || null);
      setBillingStatus((current: any) => ({
        ...(current || {}),
        billing_provider: updated.billing_provider || "mock",
        stripe_customer_id: updated.stripe_customer_id ?? null,
        stripe_subscription_id: updated.stripe_subscription_id ?? null,
        stripe_checkout_session_id: updated.stripe_checkout_session_id ?? null,
        subscription_status: updated.subscription_status || "active",
        message: "Development fallback activated.",
      }));
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

  const handleUpdateUsername = async () => {
    setSavingProfile(true);
    try {
      await api.patchMe({ username: username || undefined });
      await refreshUser();
      recordActivity({ id: "account:username", type: "account", action: "updated", name: "Username updated" });
      toast.success("Username updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update username");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateEmail = async () => {
    setSavingProfile(true);
    try {
      await api.patchMe({ email: email || undefined });
      await refreshUser();
      recordActivity({ id: "account:email", type: "account", action: "updated", name: "Email updated" });
      toast.success("Email updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update email");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      await api.changeMyPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      await refreshUser();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      recordActivity({
        id: `account:password:${Date.now()}`,
        type: "account",
        action: "updated",
        name: "Password changed",
      });
      toast.success("Password changed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.deleteAccount();
      toast.success("Account deleted");
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete account");
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl space-y-6">
        <AccountSectionNav />
        <Card className="border-slate-200 p-8 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-gray-500 dark:text-slate-400">Loading account...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <AccountSectionNav />

      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-6 py-6 md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 shadow-sm ring-4 ring-white/70 dark:ring-slate-950/50">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={`${username || "Account"} avatar`} /> : null}
                <AvatarFallback className={`text-2xl font-bold ${avatarPresetClass(avatarPreset) ?? activeHeaderTheme.avatarClass} text-white`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  Account
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{username || "Account"}</h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{email || ""}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Profile</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Identity + contact</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Security</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Password management</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Customize</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Moved to a separate page</p>
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
        secondaryAction={billingStatus?.dev_fallback_available ? () => handleUseDevFallback(selectedPlanMeta?.key) : undefined}
        secondaryActionLabel="Use dev fallback"
        statusMessage={billingMessage || billingStatus?.message || undefined}
      />

      {!hasSubscriptionAccess ? (
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Subscription plans</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Pick the plan that fits your budget and usage. Stripe handles live checkout, and local development can still use the explicit fallback.
              </p>
              <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <p>Provider: {billingStatus?.provider || "stripe"}</p>
                <p>Mode: {billingStatus?.mode || "unavailable"}</p>
                {billingStatus?.stripe_customer_id ? <p>Customer id: {billingStatus.stripe_customer_id}</p> : null}
                {billingStatus?.stripe_subscription_id ? <p>Subscription id: {billingStatus.stripe_subscription_id}</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => handleStartCheckout(selectedPlanMeta?.key)} disabled={startingBilling} className={activeHeaderTheme.buttonClass}>
                {startingBilling ? "Starting checkout..." : `Checkout ${selectedPlanMeta?.label ?? "plan"}`}
              </Button>
              <Button variant="outline" onClick={handleOpenBillingPortal} disabled={openingBillingPortal || !billingStatus?.portal_available}>
                {openingBillingPortal ? "Opening..." : "Open billing portal"}
              </Button>
              {billingStatus?.dev_fallback_available ? (
                <Button variant="secondary" onClick={() => handleUseDevFallback(selectedPlanMeta?.key)} disabled={usingDevFallback}>
                  {usingDevFallback ? "Applying fallback..." : "Use dev fallback"}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            {billingPlans.map((plan) => {
              const isSelected = selectedPlan === plan.key;
              return (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => setSelectedPlan(plan.key)}
                  className={`rounded-3xl border p-5 text-left transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-50 shadow-sm dark:border-slate-100 dark:bg-slate-900"
                      : "border-slate-200 bg-white/80 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{plan.label}</h4>
                        {plan.recommended ? (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
                            Recommended
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{plan.price_display}</p>
                    </div>
                    {isSelected ? (
                      <span className="rounded-full border border-slate-900 bg-slate-900 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{plan.description}</p>
                  <div className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <div key={`${plan.key}:${feature}`} className="text-sm text-slate-700 dark:text-slate-200">
                        • {feature}
                      </div>
                    ))}
                  </div>
                  {!plan.checkout_available ? (
                    <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Live checkout is not configured for this plan yet.</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-5 flex items-center gap-3">
              <div className={`rounded-2xl p-2.5 ${activeHeaderTheme.softPanelClass}`}>
                <User className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Profile Details</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">Keep your account identity up to date across the app.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <Label htmlFor="username" className="text-sm font-semibold text-slate-900 dark:text-slate-100">Username</Label>
                </div>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="bg-white dark:bg-slate-950/70" />
                <Button onClick={handleUpdateUsername} disabled={savingProfile} className={`mt-3 w-full ${activeHeaderTheme.buttonClass}`}>
                  Update Username
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-900 dark:text-slate-100">Email Address</Label>
                </div>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white dark:bg-slate-950/70" />
                <Button onClick={handleUpdateEmail} disabled={savingProfile} className={`mt-3 w-full ${activeHeaderTheme.buttonClass}`}>
                  Update Email
                </Button>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-5 flex items-center gap-3">
              <div className={`rounded-2xl p-2.5 ${activeHeaderTheme.softPanelClass}`}>
                <Lock className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Password</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">Change your password securely with current-password verification and automatic session rotation.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="mt-1 bg-white dark:bg-slate-950/70" />
              </div>
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" className="mt-1 bg-white dark:bg-slate-950/70" />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="mt-1 bg-white dark:bg-slate-950/70" />
              </div>
            </div>
            <Button onClick={handleChangePassword} disabled={savingPassword} className={`mt-4 ${activeHeaderTheme.buttonClass}`}>
              {savingPassword ? "Changing Password..." : "Change Password"}
            </Button>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-5 flex items-center gap-3">
              <div className={`rounded-2xl p-2.5 ${activeHeaderTheme.softPanelClass}`}>
                <Wand2 className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Workspace Settings</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">Personalization, AI controls, and achievements each live on their own account page now.</p>
              </div>
            </div>

            <div className={`rounded-2xl border p-5 ${activeHeaderTheme.softPanelClass}`}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Open dedicated account settings</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Use dedicated pages to adjust appearance, upload a profile photo, tune AI behavior, and review achievement unlocks.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild className={activeHeaderTheme.buttonClass}>
                  <Link to="/app/account/personalization">
                    <Settings2 className="h-4 w-4" />
                    Manage Personalization
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/app/account/ai">
                    <Settings2 className="h-4 w-4" />
                    Manage AI Settings
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/app/account/achievements">
                    <Award className="h-4 w-4" />
                    View Achievements
                  </Link>
                </Button>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <h3 className="mb-5 text-lg font-semibold text-slate-900 dark:text-slate-100">Account Actions</h3>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Trash2 className="mt-1 h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-200">Danger Zone</p>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Delete Account</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account and remove all your data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700">
                        Yes, delete my account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
