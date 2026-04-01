import type { RewardTier } from "./rewardTiers";

export const AVATAR_PRESETS = [
  {
    value: "midnight",
    label: "Midnight",
    unlockTier: null as RewardTier | null,
    unlockCount: 1,
    className: "bg-[linear-gradient(135deg,_#0f172a,_#334155)] text-white",
  },
  {
    value: "sunset",
    label: "Sunset",
    unlockTier: null as RewardTier | null,
    unlockCount: 2,
    className: "bg-[linear-gradient(135deg,_#fb7185,_#f97316)] text-white",
  },
  {
    value: "mint",
    label: "Mint",
    unlockTier: null as RewardTier | null,
    unlockCount: 3,
    className: "bg-[linear-gradient(135deg,_#0f766e,_#34d399)] text-white",
  },
  {
    value: "ember",
    label: "Ember",
    unlockTier: "bronze" as RewardTier,
    unlockCount: 1,
    className: "bg-[linear-gradient(135deg,_#7f1d1d,_#f43f5e)] text-white",
  },
  {
    value: "violet",
    label: "Violet",
    unlockTier: "gold" as RewardTier,
    unlockCount: 1,
    className: "bg-[linear-gradient(135deg,_#7c3aed,_#a855f7)] text-white",
  },
  {
    value: "slate",
    label: "Slate",
    unlockTier: "bronze" as RewardTier,
    unlockCount: 2,
    className: "bg-[linear-gradient(135deg,_#475569,_#94a3b8)] text-white",
  },
  {
    value: "ocean",
    label: "Ocean",
    unlockTier: "plat" as RewardTier,
    unlockCount: 1,
    className: "bg-[linear-gradient(135deg,_#1E3A8A,_#0F766E)] text-white",
  },
  {
    value: "sunrise",
    label: "Sunrise",
    unlockTier: "silver" as RewardTier,
    unlockCount: 1,
    className: "bg-[linear-gradient(135deg,_#f59e0b,_#facc15)] text-white",
  },
  {
    value: "forest",
    label: "Forest",
    unlockTier: "silver" as RewardTier,
    unlockCount: 2,
    className: "bg-[linear-gradient(135deg,_#0F766E,_#115E59)] text-white",
  },
  {
    value: "rosewood",
    label: "Rosewood",
    unlockTier: "gold" as RewardTier,
    unlockCount: 2,
    className: "bg-[linear-gradient(135deg,_#6d28d9,_#be185d)] text-white",
  },
  {
    value: "cobalt",
    label: "Cobalt",
    unlockTier: "emerald" as RewardTier,
    unlockCount: 1,
    className: "bg-[linear-gradient(135deg,_#2563EB,_#14B8A6)] text-white",
  },
  {
    value: "aurora",
    label: "Aurora",
    unlockTier: "emerald" as RewardTier,
    unlockCount: 2,
    className: "bg-[linear-gradient(135deg,_#0EA5E9,_#22C55E)] text-white",
  },
  {
    value: "sandstone",
    label: "Sandstone",
    unlockTier: "bronze" as RewardTier,
    unlockCount: 3,
    className: "bg-[linear-gradient(135deg,_#78716c,_#d6a77a)] text-white",
  },
  {
    value: "orchid",
    label: "Orchid",
    unlockTier: "gold" as RewardTier,
    unlockCount: 3,
    className: "bg-[linear-gradient(135deg,_#9333EA,_#EC4899)] text-white",
  },
  {
    value: "glacier",
    label: "Glacier",
    unlockTier: "diamond" as RewardTier,
    unlockCount: 1,
    className: "bg-[linear-gradient(135deg,_#38bdf8,_#e0f2fe)] text-slate-900",
  },
  {
    value: "abyss",
    label: "Abyss",
    unlockTier: "diamond" as RewardTier,
    unlockCount: 2,
    className: "bg-[linear-gradient(135deg,_#020617,_#1d4ed8)] text-white",
  },
  {
    value: "neptune",
    label: "Neptune",
    unlockTier: "master" as RewardTier,
    unlockCount: 1,
    className: "bg-[linear-gradient(135deg,_#22d3ee,_#2563eb)] text-white",
  },
  {
    value: "supernova",
    label: "Supernova",
    unlockTier: "master" as RewardTier,
    unlockCount: 2,
    className: "bg-[linear-gradient(135deg,_#93c5fd,_#a78bfa)] text-slate-950",
  },
] as const;

export type AvatarPresetValue = (typeof AVATAR_PRESETS)[number]["value"];

export function avatarPresetClass(value: string | null | undefined) {
  return AVATAR_PRESETS.find((preset) => preset.value === value)?.className ?? null;
}
