import { describe, expect, it } from "vitest";
import { ACCOUNT_HEADER_THEMES } from "../app/lib/headerTheme";

describe("ACCOUNT_HEADER_THEMES", () => {
  it("keeps the theme catalog balanced across starter and high-tier color families", () => {
    const sunrise = ACCOUNT_HEADER_THEMES.find((theme) => theme.value === "sunrise");
    const sandstone = ACCOUNT_HEADER_THEMES.find((theme) => theme.value === "sandstone");
    const ocean = ACCOUNT_HEADER_THEMES.find((theme) => theme.value === "ocean");
    const glacier = ACCOUNT_HEADER_THEMES.find((theme) => theme.value === "glacier");
    const neptune = ACCOUNT_HEADER_THEMES.find((theme) => theme.value === "neptune");

    expect(ACCOUNT_HEADER_THEMES).toHaveLength(14);
    expect(sunrise?.swatchColors[0]).toBe("#B45309");
    expect(sandstone?.swatchColors[0]).toBe("#78716C");
    expect(ocean?.swatchColors[0]).toBe("#1E3A8A");
    expect(glacier?.unlockTier).toBe("diamond");
    expect(neptune?.unlockTier).toBe("master");
    expect(new Set([sunrise?.swatchColors.join(","), sandstone?.swatchColors.join(","), ocean?.swatchColors.join(","), glacier?.swatchColors.join(","), neptune?.swatchColors.join(",")]).size).toBe(5);
  });
});
