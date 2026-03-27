export const AVATAR_PRESETS = [
  {
    value: "midnight",
    label: "Midnight",
    className: "bg-[linear-gradient(135deg,_#0f172a,_#334155)] text-white",
  },
  {
    value: "sunset",
    label: "Sunset",
    className: "bg-[linear-gradient(135deg,_#fb7185,_#f97316)] text-white",
  },
  {
    value: "mint",
    label: "Mint",
    className: "bg-[linear-gradient(135deg,_#0f766e,_#34d399)] text-white",
  },
  {
    value: "ember",
    label: "Ember",
    className: "bg-[linear-gradient(135deg,_#7f1d1d,_#f43f5e)] text-white",
  },
  {
    value: "violet",
    label: "Violet",
    className: "bg-[linear-gradient(135deg,_#7c3aed,_#a855f7)] text-white",
  },
  {
    value: "slate",
    label: "Slate",
    className: "bg-[linear-gradient(135deg,_#475569,_#94a3b8)] text-white",
  },
  {
    value: "ocean",
    label: "Ocean",
    className: "bg-[linear-gradient(135deg,_#1E3A8A,_#0F766E)] text-white",
  },
  {
    value: "sunrise",
    label: "Sunrise",
    className: "bg-[linear-gradient(135deg,_#f59e0b,_#facc15)] text-white",
  },
  {
    value: "forest",
    label: "Forest",
    className: "bg-[linear-gradient(135deg,_#0F766E,_#115E59)] text-white",
  },
  {
    value: "rosewood",
    label: "Rosewood",
    className: "bg-[linear-gradient(135deg,_#6d28d9,_#be185d)] text-white",
  },
  {
    value: "cobalt",
    label: "Cobalt",
    className: "bg-[linear-gradient(135deg,_#2563EB,_#14B8A6)] text-white",
  },
  {
    value: "aurora",
    label: "Aurora",
    className: "bg-[linear-gradient(135deg,_#0EA5E9,_#22C55E)] text-white",
  },
  {
    value: "sandstone",
    label: "Sandstone",
    className: "bg-[linear-gradient(135deg,_#78716c,_#d6a77a)] text-white",
  },
  {
    value: "orchid",
    label: "Orchid",
    className: "bg-[linear-gradient(135deg,_#9333EA,_#EC4899)] text-white",
  },
] as const;

export type AvatarPresetValue = (typeof AVATAR_PRESETS)[number]["value"];

export function avatarPresetClass(value: string | null | undefined) {
  return AVATAR_PRESETS.find((preset) => preset.value === value)?.className ?? null;
}
