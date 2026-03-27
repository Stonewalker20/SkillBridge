import { describe, expect, it } from "vitest";
import { ACCOUNT_HEADER_THEMES } from "../app/lib/headerTheme";

describe("ACCOUNT_HEADER_THEMES", () => {
  it("keeps the default themes balanced across distinct color families", () => {
    const sunrise = ACCOUNT_HEADER_THEMES.find((theme) => theme.value === "sunrise");
    const sandstone = ACCOUNT_HEADER_THEMES.find((theme) => theme.value === "sandstone");
    const ocean = ACCOUNT_HEADER_THEMES.find((theme) => theme.value === "ocean");

    expect(ACCOUNT_HEADER_THEMES).toHaveLength(10);
    expect(sunrise?.swatchColors[0]).toBe("#B45309");
    expect(sandstone?.swatchColors[0]).toBe("#78716C");
    expect(ocean?.swatchColors[0]).toBe("#1E3A8A");
    expect(new Set([sunrise?.swatchColors.join(","), sandstone?.swatchColors.join(","), ocean?.swatchColors.join(",")]).size).toBe(3);
  });
});
