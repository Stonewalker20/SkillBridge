import { Award, Lock, Rocket } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { AccountSectionNav } from "../components/AccountSectionNav";
import { api, type RewardsSummary } from "../services/api";
import { useHeaderTheme } from "../lib/headerTheme";
import { AVATAR_PRESETS } from "../lib/avatarPresets";
import { RewardBadgeIcon } from "../lib/rewardBadgeIcons";
import {
  REWARD_TIERS,
  highestUnlockedRewardTier,
  rewardTierAtLeast,
  rewardTierClasses,
  rewardTierLabel,
  type RewardTier,
} from "../lib/rewardTiers";

function milestoneCounterLabel(counterKey: string): string {
  switch (counterKey) {
    case "evidence_saved":
      return "evidence items";
    case "profile_skills_confirmed":
      return "confirmed skills";
    case "resume_snapshots_uploaded":
      return "resume sources";
    case "job_matches_run":
      return "job matches";
    case "tailored_resumes_generated":
      return "tailored resumes";
    default:
      return "actions";
  }
}

function milestoneNextStep(counterKey: string, remaining: number): string {
  if (remaining <= 0) return "Unlocked";
  switch (counterKey) {
    case "evidence_saved":
      return `Add ${remaining} more evidence ${remaining === 1 ? "item" : "items"}.`;
    case "profile_skills_confirmed":
      return `Confirm ${remaining} more profile ${remaining === 1 ? "skill" : "skills"}.`;
    case "resume_snapshots_uploaded":
      return `Upload ${remaining} more ${remaining === 1 ? "resume source" : "resume sources"}.`;
    case "job_matches_run":
      return `Run ${remaining} more ${remaining === 1 ? "job match" : "job matches"}.`;
    case "tailored_resumes_generated":
      return `Generate ${remaining} more tailored ${remaining === 1 ? "resume" : "resumes"}.`;
    default:
      return `Complete ${remaining} more ${remaining === 1 ? "step" : "steps"}.`;
  }
}

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
  const badges = useMemo(() => rewards?.badges ?? rewards?.achievements ?? [], [rewards]);
  const highestTier = useMemo(
    () => highestUnlockedRewardTier(badges.filter((badge) => badge.unlocked).map((badge) => badge.current_tier ?? badge.tier)),
    [badges]
  );
  const unlockedThemeCount = useMemo(
    () => themes.filter((theme) => rewardTierAtLeast(highestTier, theme.unlockTier)).length,
    [highestTier, themes]
  );
  const unlockedAvatarPresetCount = useMemo(
    () => AVATAR_PRESETS.filter((preset) => rewardTierAtLeast(highestTier, preset.unlockTier)).length,
    [highestTier]
  );
  const tierProgression = useMemo(
    () =>
      REWARD_TIERS.map((tier) => {
        const unlockedTierBadges = badges.filter((badge) => rewardTierAtLeast(badge.current_tier ?? null, tier)).length;
        return {
          tier,
          total: badges.length,
          unlocked: unlockedTierBadges,
          status: unlockedTierBadges === badges.length ? "Completed" : unlockedTierBadges > 0 ? "In progress" : "Locked",
        };
      }),
    [badges]
  );
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
                  {hasRewardData ? `${unlockedThemeCount}/${themes.length} unlocked` : "All available while sync recovers"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70 sm:col-span-1 col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Highest Tier</p>
                <div className="mt-2">
                  <span className={`rounded-full border px-2.5 py-1 text-sm font-semibold ${rewardTierClasses(highestTier).chip}`}>
                    {rewardTierLabel(highestTier)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{unlockedAvatarPresetCount}/{AVATAR_PRESETS.length} avatar colorways available</p>
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
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {nextAchievement.next_tier ? `${rewardTierLabel(nextAchievement.next_tier)} tier is next.` : "Master tier complete."}
                  </p>
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
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    {milestoneNextStep(nextAchievement.counter_key, Math.max(0, nextAchievement.target_value - nextAchievement.current_value))}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                  All current activity badges are at master tier.
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
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {achievement.current_tier ? `${rewardTierLabel(achievement.current_tier)} tier reached` : achievement.reward}
                          </p>
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

          <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Badge Vault</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Hover or focus a badge icon to inspect the unlock details. Locked badges stay shadowed until earned.
                </p>
              </div>
              <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                {badgeUnlocked}/{badgeTotal || badges.length}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {badges.map((badge) => {
                const displayTier = badge.current_tier ?? badge.next_tier ?? badge.tier;
                const tierClass = rewardTierClasses(displayTier);
                const unlocked = Boolean(badge.unlocked);
                return (
                  <div key={badge.key} className="group relative flex flex-col items-center">
                    <div
                      tabIndex={0}
                      className={`relative flex h-24 w-24 items-center justify-center rounded-3xl border bg-white/90 transition focus:outline-none focus:ring-2 ${unlocked ? `${tierClass.ring} border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-950/70` : "border-slate-300 bg-slate-200/70 shadow-[inset_0_0_30px_rgba(15,23,42,0.55)] grayscale dark:border-slate-800 dark:bg-slate-950/60"}`}
                    >
                      <RewardBadgeIcon
                        iconKey={badge.icon_key}
                        className={unlocked ? "" : "opacity-45 saturate-0"}
                      />
                      <span className={`absolute bottom-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${unlocked ? tierClass.chip : tierClass.muted}`}>
                        {rewardTierLabel(displayTier)}
                      </span>
                    </div>
                    <div className="mt-2 text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                      {badge.title}
                    </div>
                    <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-3 w-56 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 p-3 opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-950/95">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{badge.current_value}/{badge.target_value} {milestoneCounterLabel(badge.counter_key)}</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{badge.title}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${unlocked ? tierClass.chip : tierClass.muted}`}>
                          {rewardTierLabel(displayTier)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{badge.description}</p>
                      <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                        {milestoneNextStep(badge.counter_key, Math.max(0, badge.target_value - badge.current_value))}
                      </p>
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{badge.reward}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.12fr_0.88fr]">
            <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Milestone tracker</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Every milestone shows the badge tier, your current progress, and the exact action needed to move it forward.
                  </p>
                </div>
                <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                  {badgeUnlocked}/{badgeTotal}
                </Badge>
              </div>

              <div className="space-y-4">
                {badges.map((badge) => {
                  const remaining = Math.max(0, badge.target_value - badge.current_value);
                  const displayTier = badge.current_tier ?? badge.next_tier ?? badge.tier;
                  const tierClass = rewardTierClasses(displayTier);
                  return (
                    <div
                      key={`${badge.key}:milestone`}
                      className={`rounded-2xl border px-4 py-4 ${badge.unlocked ? "border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-950/60" : "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{badge.title}</p>
                            <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${badge.unlocked ? tierClass.chip : tierClass.muted}`}>
                              {badge.current_tier ? rewardTierLabel(badge.current_tier) : `${rewardTierLabel(displayTier)} next`}
                            </span>
                            <Badge variant={badge.unlocked ? "default" : "secondary"} className="gap-1.5 rounded-full">
                              {badge.current_tier ? `${rewardTierLabel(badge.current_tier)} tier` : "Locked"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{badge.description}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {badge.current_value}/{badge.target_value}
                          </p>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            {milestoneCounterLabel(badge.counter_key)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className={`h-2.5 rounded-full ${badge.unlocked ? activeHeaderTheme.barClass : "bg-slate-400 dark:bg-slate-600"}`}
                          style={{ width: `${Math.max(6, Math.min(100, badge.progress_pct))}%` }}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{milestoneNextStep(badge.counter_key, remaining)}</p>
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{badge.reward}</p>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                        {(badge.tier_progress ?? []).map((step) => {
                          const stepClass = rewardTierClasses(step.tier);
                          return (
                            <div
                              key={step.key}
                              className={`rounded-xl border px-2 py-2 text-center ${step.unlocked ? stepClass.chip : stepClass.muted}`}
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{rewardTierLabel(step.tier)}</p>
                              <p className="mt-1 text-xs">{step.target_value}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tier ladder</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Higher badge tiers unlock sharper workspace colorways and stronger avatar presets.
                </p>
              </div>

              <div className="space-y-3">
                {tierProgression.map((entry) => {
                  const tier = entry.tier as RewardTier;
                  const tierClass = rewardTierClasses(tier);
                  return (
                    <div
                      key={tier}
                      className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${rewardTierAtLeast(highestTier, tier) ? tierClass.chip : tierClass.muted}`}>
                          {rewardTierLabel(tier)}
                        </span>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {entry.unlocked}/{entry.total}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{entry.status}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Customization unlocks</p>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  {unlockedThemeCount}/{themes.length} header themes and {unlockedAvatarPresetCount}/{AVATAR_PRESETS.length} avatar colorways are currently available from your unlocked badge tiers.
                </p>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
