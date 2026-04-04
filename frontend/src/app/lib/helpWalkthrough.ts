import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Image as ImageIcon,
  LayoutDashboard,
  LifeBuoy,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

export type HelpWalkthroughSection = {
  key: string;
  title: string;
  summary: string;
  route: string;
  routeLabel: string;
  steps: string[];
  result: string;
  imageLabel: string;
  videoLabel: string;
  imageHint: string;
  videoHint: string;
  icon: LucideIcon;
};

export function getHelpWalkthroughSections(isAdminUser: boolean): HelpWalkthroughSection[] {
  return [
    {
      key: "dashboard",
      title: "Dashboard",
      summary: "Start here to see your progress, next actions, and recent activity at a glance.",
      route: "/app",
      routeLabel: "Open Dashboard",
      steps: [
        "Check the top skills and recent projects.",
        "Use the next achievement card to decide what to do next.",
        "Follow the quick links when you want to jump into a task.",
      ],
      result: "You always know what to work on next.",
      imageLabel: "Dashboard screenshot",
      videoLabel: "Dashboard walkthrough",
      imageHint: "Show the summary cards, top skills, and the next step the user should take.",
      videoHint: "A 5 to 10 second clip showing the dashboard and one quick click into a task.",
      icon: LayoutDashboard,
    },
    {
      key: "skills",
      title: "Skills",
      summary: "Keep your skills up to date, confirm what you know, and review which skills need more proof.",
      route: "/app/skills",
      routeLabel: "Open Skills",
      steps: [
        "Confirm a skill you already know.",
        "Raise or lower proficiency after reviewing the evidence.",
        "Use the hover details to see what proof supports each score.",
      ],
      result: "Your profile shows a clearer picture of what you can do.",
      imageLabel: "Skills screenshot",
      videoLabel: "Skills walkthrough",
      imageHint: "Show the skill cards, proficiency dots, and evidence hover panel.",
      videoHint: "A short clip of confirming a skill and changing its proficiency.",
      icon: BookOpen,
    },
    {
      key: "evidence",
      title: "Evidence",
      summary: "Add screenshots, notes, links, or project proof so your skills are backed by real examples.",
      route: "/app/evidence",
      routeLabel: "Open Evidence",
      steps: [
        "Add a new proof item.",
        "Attach it to the right skills and project.",
        "Keep the text short and clear so it is easy to review later.",
      ],
      result: "Your proof becomes easier to find and easier to use.",
      imageLabel: "Evidence screenshot",
      videoLabel: "Evidence walkthrough",
      imageHint: "Show the evidence card layout and the add/edit flow.",
      videoHint: "A short clip of adding a proof item and connecting it to skills.",
      icon: ImageIcon,
    },
    {
      key: "jobs",
      title: "Job Match",
      summary: "Paste a job post to see how well it fits your skills, what is missing, and what to improve.",
      route: "/app/jobs",
      routeLabel: "Open Jobs",
      steps: [
        "Paste the full job description.",
        "Read the score breakdown and the plain-language match notes.",
        "Use the missing-skill buttons to improve your profile and rerun the score.",
      ],
      result: "You can compare yourself to the job in simple terms.",
      imageLabel: "Job match screenshot",
      videoLabel: "Job match walkthrough",
      imageHint: "Show the score, breakdown, missing skills, and match notes.",
      videoHint: "A short clip of running a job match and reading the result.",
      icon: ShieldCheck,
    },
    {
      key: "analytics",
      title: "Analytics",
      summary: "Use analytics to see your learning path, career paths, and where your profile is growing.",
      route: "/app/analytics/skills",
      routeLabel: "Open Analytics",
      steps: [
        "Review your strongest skills.",
        "Open a learning path to see what to improve next.",
        "Check career paths to see which roles fit your current profile.",
      ],
      result: "You get a simple view of where to focus next.",
      imageLabel: "Analytics screenshot",
      videoLabel: "Analytics walkthrough",
      imageHint: "Show charts, learning path cards, and career path options.",
      videoHint: "A short clip of opening analytics and moving through one path.",
      icon: BarChart3,
    },
    {
      key: "personalization",
      title: "Account Settings",
      summary: "Personalize your workspace, profile image, and AI settings so the app feels like yours.",
      route: "/app/account",
      routeLabel: "Open Account",
      steps: [
        "Update your profile and workspace preferences.",
        "Adjust AI settings if you are a subscriber or admin.",
        "Use achievements and personalization to make the workspace easier to scan.",
      ],
      result: "The app matches your workflow and style.",
      imageLabel: "Account settings screenshot",
      videoLabel: "Account settings walkthrough",
      imageHint: "Show the account settings cards and a visible setting being changed.",
      videoHint: "A short clip of opening account settings and changing one preference.",
      icon: SlidersHorizontal,
    },
    {
      key: "support",
      title: "Help",
      summary: "Ask for help, check your past requests, and read admin responses in one place.",
      route: "/app/account/help",
      routeLabel: "Open Help Requests",
      steps: [
        "Choose the right help category.",
        "Describe what you were trying to do and where you got stuck.",
        "Check back here for the admin reply and mark it as read.",
      ],
      result: "You can get answers without leaving the app.",
      imageLabel: "Help screenshot",
      videoLabel: "Help walkthrough",
      imageHint: "Show the request form and the list of previous requests.",
      videoHint: "A short clip of submitting a request and opening the response.",
      icon: LifeBuoy,
    },
    ...(isAdminUser
      ? [
          {
            key: "admin",
            title: "Admin Review",
            summary: "Admins can review users, skills, jobs, and help requests from the admin workspace.",
            route: "/app/admin",
            routeLabel: "Open Admin",
            steps: [
              "Review submitted jobs before they become public.",
              "Check skills and remove bad or duplicate entries.",
              "Answer help requests and keep the platform clean.",
            ],
            result: "Admin-only tools stay separate from normal user workflows.",
            imageLabel: "Admin screenshot",
            videoLabel: "Admin walkthrough",
            imageHint: "Show the admin workspace, skill review, or job moderation table.",
            videoHint: "A short clip of reviewing one item and saving the change.",
            icon: ShieldCheck,
          },
        ]
      : []),
  ];
}

export const HELP_WALKTHROUGH_MEDIA_TIPS = [
  "Use one clear screenshot for the page and one short 5 to 10 second clip for the action.",
  "Keep clips focused on one task, like confirming a skill or submitting help.",
  "Good filenames: `dashboard-walkthrough.png`, `skills-demo.mp4`, `help-response.mp4`.",
];
