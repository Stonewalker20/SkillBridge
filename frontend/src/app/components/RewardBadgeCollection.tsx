import { Award, CheckCircle2, Lock } from "lucide-react";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { type RewardBadge } from "../services/api";
import { RewardBadgeIcon } from "../lib/rewardBadgeIcons";

export function RewardBadgeCollection({
  badges,
  unlockedCount,
  totalCount,
}: {
  badges: RewardBadge[];
  unlockedCount: number;
  totalCount: number;
}) {
  return (
    <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-[linear-gradient(135deg,_rgba(59,130,246,0.12),_rgba(255,255,255,0.9))] p-2.5 dark:bg-[linear-gradient(135deg,_rgba(59,130,246,0.18),_rgba(15,23,42,0.96))]">
          <Award className="h-5 w-5 text-blue-600 dark:text-blue-300" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Badge Collection</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {unlockedCount}/{totalCount} unlocked and available to show across your account.
          </p>
        </div>
      </div>

      {badges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
          No badges are available yet. Start saving evidence, confirming skills, and generating resumes to unlock your first badge.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {badges.map((badge) => {
            const isUnlocked = Boolean(badge.unlocked);
            return (
              <div
                key={badge.key}
                className={`rounded-2xl border px-4 py-4 transition ${
                  isUnlocked
                    ? "border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950/70"
                    : "border-slate-200 bg-slate-50/80 opacity-80 dark:border-slate-800 dark:bg-slate-950/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <RewardBadgeIcon iconKey={badge.icon_key} className="shrink-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{badge.title}</p>
                        <Badge variant={isUnlocked ? "default" : "secondary"} className="gap-1.5 rounded-full">
                          {isUnlocked ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                          {isUnlocked ? "Unlocked" : "Locked"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{badge.description}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {badge.reward}
                  </p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {badge.current_value}/{badge.target_value}
                  </p>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${isUnlocked ? "bg-[linear-gradient(90deg,_#2563EB,_#0F766E)]" : "bg-slate-300 dark:bg-slate-600"}`}
                    style={{ width: `${Math.max(6, Math.min(100, badge.progress_pct))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Unlocked badges also expand your available header color options.
      </p>
    </Card>
  );
}
