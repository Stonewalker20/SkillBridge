import { Award, Lock, Rocket } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { RewardBadgeCollection } from "../components/RewardBadgeCollection";
import { AccountSectionNav } from "../components/AccountSectionNav";
import { api, type RewardsSummary } from "../services/api";
import { useHeaderTheme } from "../lib/headerTheme";

export function AccountAchievements() {
  const { activeHeaderTheme, themes } = useHeaderTheme();
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const summary = await api.getRewardsSummary().catch(() => null);
        if (!active) return;
        setRewards(summary);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const badgeTotal = rewards?.badgeCount ?? rewards?.totalCount ?? rewards?.achievements.length ?? 0;
  const badgeUnlocked = rewards?.unlockedBadgeCount ?? rewards?.unlockedCount ?? 0;
  const hasRewardData = Boolean(rewards && (badgeTotal > 0 || rewards.achievements.length > 0 || (rewards.badges?.length ?? 0) > 0));
  const nextAchievement = rewards?.nextAchievement ?? null;
  const recentUnlocks = rewards?.recentUnlocks ?? [];
  const badges = rewards?.badges ?? rewards?.achievements ?? [];
  const unlockRate = useMemo(() => {
    if (!hasRewardData || badgeTotal <= 0) return 0;
    return Math.round((badgeUnlocked / badgeTotal) * 100);
  }, [badgeTotal, badgeUnlocked, hasRewardData]);

  return (
    <div className="max-w-6xl space-y-6">
      <AccountSectionNav />

      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-6 py-6 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                <Award className="h-3.5 w-3.5" />
                Achievements
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Badge progress and unlock history.</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Achievements unlock badges, and unlocked badges expand the header theme options available in personalization.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Unlocked</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{hasRewardData ? `${badgeUnlocked}/${badgeTotal}` : "Syncing"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Completion</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{hasRewardData ? `${unlockRate}%` : "Unavailable"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70 sm:col-span-1 col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Themes</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {hasRewardData ? `${Math.min(themes.length, 3 + badgeUnlocked)} unlocked` : "All available while sync recovers"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-sm text-slate-600 dark:text-slate-300">Loading achievement progress...</div>
        </Card>
      ) : !hasRewardData ? (
        <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Achievement sync is unavailable right now.</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Your rewards endpoint did not return usable milestone data, so theme gating stays open until sync recovers.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/app/account/personalization">Open Personalization</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center gap-2">
                <Rocket className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Next milestone</h3>
              </div>
              {nextAchievement ? (
                <>
                  <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{nextAchievement.title}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{nextAchievement.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {nextAchievement.current_value}/{nextAchievement.target_value}
                    </span>
                    <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                      {Math.round(nextAchievement.progress_pct)}%
                    </Badge>
                  </div>
                  <div className="mt-3 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className={`h-2.5 rounded-full ${activeHeaderTheme.barClass}`} style={{ width: `${Math.max(6, nextAchievement.progress_pct)}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{nextAchievement.reward}</p>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                  All current milestones are unlocked. New badges can be layered onto this system without losing your history.
                </p>
              )}
            </Card>

            <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center gap-2">
                <Lock className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent unlocks</h3>
              </div>
              {recentUnlocks.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No recent unlock timestamps are available yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentUnlocks.map((achievement) => (
                    <div key={achievement.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{achievement.title}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{achievement.reward}</p>
                        </div>
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                          Unlocked
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <RewardBadgeCollection badges={badges} unlockedCount={badgeUnlocked} totalCount={badgeTotal || badges.length} />
        </>
      )}
    </div>
  );
}
