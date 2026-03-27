import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../components/ui/card";
import { cn } from "../components/ui/utils";
import { Badge } from "../components/ui/badge";

type AnalyticsSectionProps = {
  id?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

export function AnalyticsSection({ id, title, description, actions, children, className, compact = false }: AnalyticsSectionProps) {
  return (
    <Card id={id} className={cn("border-slate-200 dark:border-slate-800 dark:bg-slate-900/80", compact ? "p-4" : "p-5", className)}>
      <div className={cn("flex items-start justify-between gap-4", compact ? "mb-3" : "mb-4")}>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 md:text-lg">{title}</h3>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </Card>
  );
}

type AnalyticsMetricProps = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  toneClass: string;
};

export function AnalyticsMetric({ icon: Icon, label, value, caption, toneClass }: AnalyticsMetricProps) {
  return (
    <Card className="border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-start gap-3">
        <div className={cn("rounded-2xl p-3", toneClass)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
          {caption ? <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{caption}</p> : null}
        </div>
      </div>
    </Card>
  );
}

type BadgeCloudProps = {
  items: string[];
  emptyLabel: string;
  variant?: "secondary" | "outline";
  className?: string;
  badgeClassName?: string;
  limit?: number;
};

export function BadgeCloud({ items, emptyLabel, variant = "secondary", className, badgeClassName, limit }: BadgeCloudProps) {
  if (!items.length) {
    return <div className={cn("text-sm text-slate-500 dark:text-slate-400", className)}>{emptyLabel}</div>;
  }

  const visibleItems = typeof limit === "number" && limit >= 0 ? items.slice(0, limit) : items;
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {visibleItems.map((item) => (
        <Badge key={item} variant={variant} className={badgeClassName}>
          {item}
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Badge variant={variant} className={badgeClassName}>
          +{hiddenCount} more
        </Badge>
      ) : null}
    </div>
  );
}
