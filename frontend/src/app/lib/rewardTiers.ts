export const REWARD_TIERS = ["bronze", "silver", "gold", "plat", "emerald", "diamond", "master"] as const;

export type RewardTier = (typeof REWARD_TIERS)[number];

const REWARD_TIER_ORDER = new Map<RewardTier, number>(REWARD_TIERS.map((tier, index) => [tier, index]));

export function rewardTierRank(tier: RewardTier | null | undefined): number {
  if (!tier) return -1;
  return REWARD_TIER_ORDER.get(tier) ?? -1;
}

export function rewardTierAtLeast(current: RewardTier | null | undefined, required: RewardTier | null | undefined): boolean {
  if (!required) return true;
  return rewardTierRank(current) >= rewardTierRank(required);
}

export function highestUnlockedRewardTier(tiers: Array<RewardTier | null | undefined>): RewardTier | null {
  let best: RewardTier | null = null;
  for (const tier of tiers) {
    if (!tier) continue;
    if (!best || rewardTierRank(tier) > rewardTierRank(best)) best = tier;
  }
  return best;
}

export function rewardTierLabel(tier: RewardTier | null | undefined): string {
  switch (tier) {
    case "bronze":
      return "Bronze";
    case "silver":
      return "Silver";
    case "gold":
      return "Gold";
    case "plat":
      return "Plat";
    case "emerald":
      return "Emerald";
    case "diamond":
      return "Diamond";
    case "master":
      return "Master";
    default:
      return "Starter";
  }
}

export function rewardTierClasses(tier: RewardTier | null | undefined): { chip: string; ring: string; muted: string } {
  switch (tier) {
    case "bronze":
      return {
        chip: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
        ring: "ring-amber-300/70 dark:ring-amber-700/60",
        muted: "border-amber-200/60 bg-amber-50/40 text-amber-700/80 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300/70",
      };
    case "silver":
      return {
        chip: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
        ring: "ring-slate-300/70 dark:ring-slate-600/60",
        muted: "border-slate-200/70 bg-slate-100/50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400",
      };
    case "gold":
      return {
        chip: "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200",
        ring: "ring-yellow-300/70 dark:ring-yellow-700/60",
        muted: "border-yellow-200/60 bg-yellow-50/40 text-yellow-700/80 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-300/70",
      };
    case "plat":
      return {
        chip: "border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200",
        ring: "ring-cyan-300/70 dark:ring-cyan-700/60",
        muted: "border-cyan-200/60 bg-cyan-50/40 text-cyan-700/80 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300/70",
      };
    case "emerald":
      return {
        chip: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
        ring: "ring-emerald-300/70 dark:ring-emerald-700/60",
        muted: "border-emerald-200/60 bg-emerald-50/40 text-emerald-700/80 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300/70",
      };
    case "diamond":
      return {
        chip: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
        ring: "ring-sky-300/70 dark:ring-sky-700/60",
        muted: "border-sky-200/60 bg-sky-50/40 text-sky-700/80 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300/70",
      };
    case "master":
      return {
        chip: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-200",
        ring: "ring-fuchsia-300/70 dark:ring-fuchsia-700/60",
        muted: "border-fuchsia-200/60 bg-fuchsia-50/40 text-fuchsia-700/80 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/20 dark:text-fuchsia-300/70",
      };
    default:
      return {
        chip: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
        ring: "ring-slate-300/70 dark:ring-slate-600/60",
        muted: "border-slate-200/70 bg-slate-100/50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400",
      };
  }
}
