import { describe, expect, it } from "vitest";
import { AVATAR_PRESETS, avatarPresetClass } from "../app/lib/avatarPresets";

describe("avatarPresetClass", () => {
  it("returns the matching preset class for known values", () => {
    expect(avatarPresetClass("ocean")).toBe("bg-[linear-gradient(135deg,_#1E3A8A,_#0F766E)] text-white");
    expect(avatarPresetClass("aurora")).toBe("bg-[linear-gradient(135deg,_#0EA5E9,_#22C55E)] text-white");
  });

  it("keeps the warmer presets visually distinct", () => {
    const warmPresetClasses = ["sunset", "ember", "sunrise", "rosewood", "sandstone"].map((value) => avatarPresetClass(value));
    expect(new Set(warmPresetClasses).size).toBe(warmPresetClasses.length);
  });

  it("returns null for unknown values", () => {
    expect(avatarPresetClass("unknown")).toBeNull();
    expect(avatarPresetClass(null)).toBeNull();
  });

  it("keeps the preset catalog populated", () => {
    expect(AVATAR_PRESETS.length).toBe(18);
    expect(AVATAR_PRESETS.find((preset) => preset.value === "glacier")?.unlockTier).toBe("diamond");
    expect(AVATAR_PRESETS.find((preset) => preset.value === "supernova")?.unlockTier).toBe("master");
  });
});
