import type { LucideIcon } from "lucide-react";
import { BarChart3, Briefcase, FileText, FolderOpen, SlidersHorizontal, Target } from "lucide-react";

export type GetStartedStepKey =
  | "skills"
  | "evidence"
  | "job-match"
  | "resumes"
  | "analytics"
  | "personalization";

export type GetStartedStep = {
  key: GetStartedStepKey;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: LucideIcon;
};

export type GetStartedGuidance = {
  stepKey: GetStartedStepKey;
  title: string;
  body: string;
  hint: string;
  href: string;
  cta: string;
};

export const GET_STARTED_STEPS: GetStartedStep[] = [
  {
    key: "skills",
    title: "Confirm your skills",
    description: "Review the profile skills SkillBridge extracted and confirm the ones you want on your profile.",
    href: "/app/skills",
    cta: "Open skills",
    icon: Target,
  },
  {
    key: "evidence",
    title: "Upload evidence",
    description: "Attach proof of work so proficiency scoring and tailoring can rely on real supporting material.",
    href: "/app/evidence?add=1",
    cta: "Add evidence",
    icon: FolderOpen,
  },
  {
    key: "job-match",
    title: "Run a job match",
    description: "Paste a job posting and compare it to your current profile to surface strengths and gaps.",
    href: "/app/jobs?analyze=1",
    cta: "Analyze a job",
    icon: Briefcase,
  },
  {
    key: "resumes",
    title: "Review tailored resumes",
    description: "Use your saved profile data to generate targeted resume drafts instead of starting from scratch.",
    href: "/app/resumes",
    cta: "View resumes",
    icon: FileText,
  },
  {
    key: "analytics",
    title: "Check analytics",
    description: "Inspect category coverage, evidence support, and the learning-path view after your first match.",
    href: "/app/analytics/skills",
    cta: "Open analytics",
    icon: BarChart3,
  },
  {
    key: "personalization",
    title: "Tune your workspace",
    description: "Adjust your workspace layout and visual setup once the core workflow is in place.",
    href: "/app/account/personalization",
    cta: "Personalize",
    icon: SlidersHorizontal,
  },
];

const ROUTE_GUIDANCE: Array<{
  match: (pathname: string) => boolean;
  guidance: GetStartedGuidance;
}> = [
  {
    match: (pathname) => pathname === "/app" || pathname.startsWith("/app?"),
    guidance: {
      stepKey: "skills",
      title: "Start by confirming your profile skills",
      body: "The rest of the platform becomes more useful once your base skill list reflects what you actually want matched and analyzed.",
      hint: "Confirm a focused set of core skills first. You can broaden the profile after evidence and job matching are in place.",
      href: "/app/skills",
      cta: "Go to skills",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/app/skills"),
    guidance: {
      stepKey: "skills",
      title: "Use this page to lock in your starting profile",
      body: "Confirm the skills you genuinely want on your profile and leave questionable ones unconfirmed so later scoring stays clean.",
      hint: "If a skill looks right but weak, confirm it now and strengthen it with evidence on the next step.",
      href: "/app/evidence?add=1",
      cta: "Next: add evidence",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/app/evidence"),
    guidance: {
      stepKey: "evidence",
      title: "Ground your profile with proof of work",
      body: "Evidence is what turns confirmed skills into credible signals for proficiency, analytics, and tailoring.",
      hint: "Start with one or two strong items tied to the skills you care most about rather than uploading everything at once.",
      href: "/app/jobs?analyze=1",
      cta: "Next: analyze a job",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/app/jobs"),
    guidance: {
      stepKey: "job-match",
      title: "Run your first grounded job comparison",
      body: "Matching a real posting shows whether your current profile is missing skills, missing evidence, or just needs clearer positioning.",
      hint: "Use a real posting you would plausibly apply to so the gaps and tailored resume output are worth keeping.",
      href: "/app/resumes",
      cta: "Next: review resumes",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/app/resumes"),
    guidance: {
      stepKey: "resumes",
      title: "Check what the platform can draft from your profile",
      body: "This is where the earlier setup work turns into actual application material instead of staying theoretical.",
      hint: "If the tailored resume feels thin, the fix is usually more evidence or sharper confirmed skills, not more prompt tweaking.",
      href: "/app/analytics/skills",
      cta: "Next: open analytics",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/app/analytics"),
    guidance: {
      stepKey: "analytics",
      title: "Use analytics to decide what to strengthen next",
      body: "Analytics helps you see which skills are already supported and which categories still need evidence or confirmed coverage.",
      hint: "This page is most useful after you have at least one job match and a small set of evidence items saved.",
      href: "/app/account/personalization",
      cta: "Next: personalize",
    },
  },
  {
    match: (pathname) => pathname.startsWith("/app/account/personalization"),
    guidance: {
      stepKey: "personalization",
      title: "Now tune the workspace around your workflow",
      body: "Once the main profile setup is done, this is where you make the app feel lighter and more tailored to how you work.",
      hint: "Use sidebar visibility and card preferences to keep the surfaces you actually use in front of you.",
      href: "/app/account/help?category=onboarding",
      cta: "Need help?",
    },
  },
];

export function getGetStartedGuidance(pathname: string): GetStartedGuidance | null {
  const match = ROUTE_GUIDANCE.find((entry) => entry.match(pathname));
  return match?.guidance ?? null;
}

export function getStepByKey(stepKey: GetStartedStepKey | string | null | undefined): GetStartedStep | null {
  const normalized = String(stepKey || "").trim();
  return GET_STARTED_STEPS.find((step) => step.key === normalized) ?? null;
}
