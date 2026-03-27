import { describe, expect, it } from "vitest";
import { normalizeRewardsSummary } from "../app/services/api";

describe("normalizeRewardsSummary", () => {
  it("normalizes badge counts and falls back to achievements when badges are absent", () => {
    const summary = normalizeRewardsSummary({
      counters: {
        evidence_saved: 2,
        profile_skills_confirmed: 1,
        resume_snapshots_uploaded: 1,
        job_matches_run: 0,
        tailored_resumes_generated: 0,
      },
      unlocked_count: 1,
      total_count: 2,
      achievements: [
        {
          key: "evidence_saved",
          title: "Proof Builder",
          description: "Save evidence consistently.",
          reward: "Next tier: Silver at 3 evidence items.",
          counter_key: "evidence_saved",
          current_value: 2,
          target_value: 3,
          progress_pct: 66.67,
          unlocked: true,
          current_tier: "bronze",
          next_tier: "silver",
        },
        {
          key: "resume_snapshots_uploaded",
          title: "Resume Foundation",
          description: "Add resume sources.",
          reward: "Next tier: Bronze at 1 resume sources.",
          counter_key: "resume_snapshots_uploaded",
          current_value: 0,
          target_value: 1,
          progress_pct: 0,
          unlocked: false,
          current_tier: null,
          next_tier: "bronze",
        },
      ],
    });

    expect(summary.badges).toHaveLength(2);
    expect(summary.badgeCount).toBe(2);
    expect(summary.unlockedBadgeCount).toBe(1);
    expect(summary.badges?.[0].key).toBe("evidence_saved");
    expect(summary.badges?.[0].icon_key).toBe("award");
    expect(summary.badges?.[0].tier).toBe("bronze");
    expect(summary.badges?.[0].next_tier).toBe("silver");
  });

  it("builds the default achievement ladder from counters when the backend response is partial", () => {
    const summary = normalizeRewardsSummary({
      counters: {
        evidence_saved: 100,
        profile_skills_confirmed: 50,
        resume_snapshots_uploaded: 25,
        job_matches_run: 10,
        tailored_resumes_generated: 5,
      },
    });

    expect(summary.achievements).toHaveLength(5);
    expect(summary.totalCount).toBe(5);
    expect(summary.unlockedCount).toBe(5);
    expect(summary.badgeCount).toBe(5);
    expect(summary.unlockedBadgeCount).toBe(5);
    expect(summary.nextAchievement?.key).toBe("tailored_resumes_generated");
    expect(summary.achievements[0]?.icon_key).toBe("spark");
    expect(summary.achievements[0]?.tier).toBe("master");
    expect(summary.achievements[1]?.tier).toBe("diamond");
    expect(summary.achievements[2]?.tier).toBe("emerald");
    expect(summary.achievements.at(-1)?.tier).toBe("gold");
    expect(summary.achievements[0]?.tier_progress).toHaveLength(7);
  });
});
