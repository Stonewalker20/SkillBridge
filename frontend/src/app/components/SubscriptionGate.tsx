import { Link } from "react-router";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { cn } from "./ui/utils";
import { LockKeyhole, Sparkles, ShieldCheck } from "lucide-react";

type SubscriptionGateProps = {
  active: boolean;
  plan?: string | null;
  renewalAt?: string | null;
  role?: string | null;
  compact?: boolean;
  className?: string;
  onActivate?: () => void | Promise<void>;
  activating?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
};

function formatRenewal(value?: string | null) {
  if (!value) return "No renewal date set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No renewal date set";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function SubscriptionGate({
  active,
  plan,
  renewalAt,
  role,
  compact = false,
  className,
  onActivate,
  activating = false,
  ctaHref = "/app/account",
  ctaLabel,
}: SubscriptionGateProps) {
  const isAdminRole = ["owner", "admin", "team"].includes(String(role ?? "").toLowerCase());
  const surfaceClass = compact
    ? "border-slate-200 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70"
    : "border-slate-200 bg-[linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(239,246,255,0.92)_45%,_rgba(255,255,255,0.98))] p-6 shadow-sm dark:border-slate-800 dark:bg-[linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.98))]";

  if (active) {
    return (
      <Card className={cn(surfaceClass, className)}>
        <div className={cn("flex gap-4", compact ? "items-start" : "items-center")}>
          <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Subscription active
              </p>
              <Badge variant="secondary" className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                {plan || (isAdminRole ? "Included" : "Pro")}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              {isAdminRole
                ? "Your role includes access to the full platform."
                : `Your workspace is unlocked until ${formatRenewal(renewalAt)}.`}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(surfaceClass, "overflow-hidden", className)}>
      <div className={cn("flex gap-5", compact ? "flex-col" : "flex-col lg:flex-row lg:items-start")}>
        <div className="rounded-3xl bg-[linear-gradient(135deg,_#1E3A8A,_#0F766E)] p-4 text-white shadow-sm">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Subscription required
            </p>
            <Badge variant="outline" className="border-slate-200 bg-white/90 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
              Locked
            </Badge>
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Unlock the platform with a mock subscription
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            You can sign in and manage your account, but core workflow tools stay locked until you activate the subscription state.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Evidence", "Skills", "Job Match", "Tailored resumes"].map((item) => (
              <Badge key={item} variant="secondary" className="border-transparent bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {item}
              </Badge>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {onActivate ? (
              <Button onClick={onActivate} disabled={activating} className="bg-[#1E3A8A] text-white hover:bg-[#1d4ed8]">
                <Sparkles className="h-4 w-4" />
                {activating ? "Activating..." : ctaLabel || "Activate subscription"}
              </Button>
            ) : (
              <Button asChild className="bg-[#1E3A8A] text-white hover:bg-[#1d4ed8]">
                <Link to={ctaHref}>
                  <Sparkles className="h-4 w-4" />
                  {ctaLabel || "Open account"}
                </Link>
              </Button>
            )}
            <div className="text-sm text-slate-500 dark:text-slate-400">
              This is a mocked activation flow. No payment processor is connected.
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
