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
    value: "cloud",
    label: "Cloud",
    unlockTier: null as RewardTier | null,
    unlockCount: 4,
    className: "bg-[linear-gradient(135deg,_#e0f2fe,_#bfdbfe)] text-slate-900",
  },
  {
    value: "ember",
    label: "Ember",
    unlockTier: "bronze" as RewardTier,
    unlockCount: 1,
    className: "bg-[linear-gradient(135deg,_#7f1d1d,_#f43f5e)] text-white",
  },
  {
    value: "slate",
    label: "Slate",
    unlockTier: "bronze" as RewardTier,
    unlockCount: 2,
    className: "bg-[linear-gradient(135deg,_#475569,_#94a3b8)] text-white",
  },
  {
    value: "sandstone",
    label: "Sandstone",
    unlockTier: "bronze" as RewardTier,
    unlockCount: 3,
    className: "bg-[linear-gradient(135deg,_#78716c,_#d6a77a)] text-white",
  },
  {
    value: "copper",
    label: "Copper",
    unlockTier: "bronze" as RewardTier,
    unlockCount: 4,
    className: "bg-[linear-gradient(135deg,_#9a3412,_#f97316)] text-white",
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
    value: "moonstone",
    label: "Moonstone",
    unlockTier: "silver" as RewardTier,
    unlockCount: 3,
    className: "bg-[linear-gradient(135deg,_#475569,_#cbd5e1)] text-white",
  },
  {
    value: "petal",
    label: "Petal",
    unlockTier: "silver" as RewardTier,
    unlockCount: 4,
    className: "bg-[linear-gradient(135deg,_#be185d,_#f9a8d4)] text-white",
  },
  {
    value: "violet",
    label: "Violet",
    unlockTier: "gold" as RewardTier,
    unlockCount: 1,
    className: "bg-[linear-gradient(135deg,_#7c3aed,_#a855f7)] text-white",
  },
  {
    value: "rosewood",
    label: "Rosewood",
    unlockTier: "gold" as RewardTier,
    unlockCount: 2,
    className: "bg-[linear-gradient(135deg,_#6d28d9,_#be185d)] text-white",
  },
  {
    value: "orchid",
    label: "Orchid",
    unlockTier: "gold" as RewardTier,
    unlockCount: 3,
    className: "bg-[linear-gradient(135deg,_#9333EA,_#EC4899)] text-white",
  },
  {
    value: "citrine",
    label: "Citrine",
    unlockTier: "gold" as RewardTier,
    unlockCount: 4,
    className: "bg-[linear-gradient(135deg,_#d97706,_#facc15)] text-white",
  },
  {
    value: "ocean",
    label: "Ocean",
    unlockTier: "plat" as RewardTier,
    unlockCount: 1,
    className: "bg-[linear-gradient(135deg,_#1E3A8A,_#0F766E)] text-white",
  },
  {
    value: "voltage",
    label: "Voltage",
    unlockTier: "plat" as RewardTier,
    unlockCount: 2,
    className:
      "bg-[length:220%_220%] animate-[theme-neon-flow_10s_ease-in-out_infinite] bg-[linear-gradient(135deg,_#0f172a,_#2563eb,_#22d3ee)] text-white",
  },
  {
    value: "tidal",
    label: "Tidal",
    unlockTier: "plat" as RewardTier,
    unlockCount: 3,
    className:
      "bg-[length:220%_220%] animate-[theme-neptune-flow_12s_ease-in-out_infinite] bg-[linear-gradient(135deg,_#0f766e,_#2563eb,_#67e8f9)] text-white",
  },
  {
    value: "nova",
    label: "Nova",
    unlockTier: "plat" as RewardTier,
    unlockCount: 4,
    className:
      "bg-[length:220%_220%] animate-[theme-supernova-flow_12s_ease-in-out_infinite] bg-[linear-gradient(135deg,_#4338ca,_#60a5fa,_#93c5fd)] text-white",
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
    value: "verdant",
    label: "Verdant",
    unlockTier: "emerald" as RewardTier,
    unlockCount: 3,
    className:
      "bg-[length:220%_220%] animate-[theme-neon-flow_10s_ease-in-out_infinite] bg-[linear-gradient(135deg,_#166534,_#22c55e,_#86efac)] text-white",
  },
  {
    value: "lagoon",
    label: "Lagoon",
    unlockTier: "emerald" as RewardTier,
    unlockCount: 4,
    className:
      "bg-[length:220%_220%] animate-[theme-neptune-flow_12s_ease-in-out_infinite] bg-[linear-gradient(135deg,_#0f766e,_#14b8a6,_#67e8f9)] text-white",
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
    value: "starlight",
    label: "Starlight",
    unlockTier: "diamond" as RewardTier,
    unlockCount: 3,
    className:
      "bg-[length:220%_220%] animate-[theme-supernova-flow_12s_ease-in-out_infinite] bg-[linear-gradient(135deg,_#e0e7ff,_#93c5fd,_#a78bfa)] text-slate-950",
  },
  {
    value: "ion",
    label: "Ion",
    unlockTier: "diamond" as RewardTier,
    unlockCount: 4,
    className:
      "bg-[length:220%_220%] animate-[theme-neptune-flow_10s_ease-in-out_infinite] bg-[linear-gradient(135deg,_#082f49,_#38bdf8,_#ecfeff)] text-white",
  },
  {
    value: "neptune",
    label: "Neptune",
    unlockTier: "master" as RewardTier,
    unlockCount: 1,
    className:
      "bg-[length:240%_240%] animate-[theme-neptune-flow_10s_ease-in-out_infinite] bg-[linear-gradient(135deg,_#22d3ee,_#2563eb,_#7c3aed)] text-white",
  },
  {
    value: "supernova",
    label: "Supernova",
    unlockTier: "master" as RewardTier,
    unlockCount: 2,
    className:
      "bg-[length:240%_240%] animate-[theme-supernova-flow_12s_ease-in-out_infinite] bg-[linear-gradient(135deg,_#93c5fd,_#a78bfa,_#f5d0fe)] text-slate-950",
  },
  {
    value: "prism",
    label: "Prism",
    unlockTier: "master" as RewardTier,
    unlockCount: 3,
    className:
      "bg-[length:260%_260%] animate-[theme-rainbow-flow_10s_linear_infinite] bg-[linear-gradient(135deg,_#f59e0b,_#22c55e,_#3b82f6,_#a855f7)] text-white",
  },
  {
    value: "quantum",
    label: "Quantum",
    unlockTier: "master" as RewardTier,
    unlockCount: 4,
    className:
      "bg-[length:240%_240%] animate-[theme-neon-flow_9s_ease-in-out_infinite] bg-[linear-gradient(135deg,_#0f172a,_#22d3ee,_#ec4899,_#a855f7)] text-white",
  },
] as const;

export type AvatarPresetValue = (typeof AVATAR_PRESETS)[number]["value"];

export function avatarPresetClass(value: string | null | undefined) {
  return AVATAR_PRESETS.find((preset) => preset.value === value)?.className ?? null;
}
