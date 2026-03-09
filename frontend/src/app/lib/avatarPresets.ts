export const AVATAR_PRESETS = [
  {
    value: "midnight",
    label: "Midnight",
    className: "bg-[linear-gradient(135deg,_#0f172a,_#334155)] text-white",
  },
  {
    value: "sunset",
    label: "Sunset",
    className: "bg-[linear-gradient(135deg,_#f97316,_#fb7185)] text-white",
  },
  {
    value: "mint",
    label: "Mint",
    className: "bg-[linear-gradient(135deg,_#0f766e,_#34d399)] text-white",
  },
  {
    value: "ember",
    label: "Ember",
    className: "bg-[linear-gradient(135deg,_#dc2626,_#f59e0b)] text-white",
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
] as const;

export type AvatarPresetValue = (typeof AVATAR_PRESETS)[number]["value"];

export function avatarPresetClass(value: string | null | undefined) {
  return AVATAR_PRESETS.find((preset) => preset.value === value)?.className ?? null;
}
