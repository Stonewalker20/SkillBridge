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
          key: "first_evidence_saved",
          title: "First Proof Added",
          description: "Save your first evidence item.",
          reward: "Unlocked: Evidence Starter badge",
          counter_key: "evidence_saved",
          current_value: 2,
          target_value: 1,
          progress_pct: 100,
          unlocked: true,
        },
        {
          key: "first_resume_uploaded",
          title: "Template Ready",
          description: "Upload or paste a resume.",
          reward: "Unlocked: Resume Template badge",
          counter_key: "resume_snapshots_uploaded",
          current_value: 1,
          target_value: 1,
          progress_pct: 100,
          unlocked: false,
        },
      ],
    });

    expect(summary.badges).toHaveLength(2);
    expect(summary.badgeCount).toBe(2);
    expect(summary.unlockedBadgeCount).toBe(1);
    expect(summary.badges?.[0].key).toBe("first_evidence_saved");
    expect(summary.badges?.[0].icon_key).toBe("award");
  });

  it("builds the default achievement ladder from counters when the backend response is partial", () => {
    const summary = normalizeRewardsSummary({
      counters: {
        evidence_saved: 3,
        profile_skills_confirmed: 5,
        resume_snapshots_uploaded: 1,
        job_matches_run: 3,
        tailored_resumes_generated: 1,
      },
    });

    expect(summary.achievements).toHaveLength(8);
    expect(summary.totalCount).toBe(8);
    expect(summary.unlockedCount).toBe(8);
    expect(summary.badgeCount).toBe(8);
    expect(summary.unlockedBadgeCount).toBe(8);
    expect(summary.nextAchievement).toBeNull();
    expect(summary.achievements[0]?.icon_key).toBe("spark");
  });
});
