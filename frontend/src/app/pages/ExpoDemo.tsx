import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Award,
  Briefcase,
  ChevronRight,
  FileText,
  FolderKanban,
  PlayCircle,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import LogoImage from "../../imports/skillbridge_logo.png";
import { PublicThemeToggle } from "../components/PublicThemeToggle";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

type DemoView = "skills" | "evidence" | "match" | "resume";

const demoVideoUrl = String(import.meta.env.VITE_EXPO_DEMO_VIDEO_URL || "").trim() || "/expo-demo-walkthrough.mov";

const navItems: Array<{ key: DemoView; label: string; note: string; icon: typeof Target }> = [
  { key: "skills", label: "Skills", note: "Confirmed strengths and proof coverage", icon: Target },
  { key: "evidence", label: "Evidence", note: "Projects, work, and certifications", icon: FolderKanban },
  { key: "match", label: "Job Match", note: "Readable scoring and gap review", icon: Briefcase },
  { key: "resume", label: "Tailored Resume", note: "Targeted output preview", icon: FileText },
];

const overviewCards = [
  { label: "Confirmed Skills", value: "34", detail: "28 supported by evidence" },
  { label: "Evidence Items", value: "12", detail: "Work, projects, certifications" },
  { label: "Match Score", value: "87%", detail: "Machine Learning Engineer II" },
];

const skillCards = [
  { name: "Python", status: "Confirmed", proof: "Supported by internship, capstone, and analytics evidence." },
  { name: "Machine Learning", status: "Confirmed", proof: "Supported by forecasting, monitoring, and deployment work." },
  { name: "Model Monitoring", status: "Confirmed", proof: "Linked to dashboard evidence and ML platform delivery." },
  { name: "Deployment APIs", status: "Gap closing", proof: "One more strong evidence item would move this to fully supported." },
];

const evidenceItems = [
  {
    title: "Retail Forecasting Internship",
    type: "Professional Experience",
    summary: "Built Python forecasting workflows, stakeholder dashboards, and production reporting for retail planning teams.",
    skills: ["Python", "Machine Learning", "Forecasting"],
  },
  {
    title: "Model Monitoring Dashboard",
    type: "Project",
    summary: "Designed a monitoring workflow that tracked drift, regressions, and deployment health for ML systems.",
    skills: ["Model Monitoring", "PyTorch", "Dashboards"],
  },
  {
    title: "AWS ML Specialty",
    type: "Certification",
    summary: "Added cloud deployment and inference credibility for production ML workflows.",
    skills: ["AWS", "Deployment", "ML Systems"],
  },
];

const matchBreakdown = [
  { label: "Important skills", score: 92, summary: "Counted here: Python, Machine Learning, Model Monitoring, Deployment APIs." },
  { label: "Evidence support", score: 84, summary: "Used here: Retail Forecasting Internship, Model Monitoring Dashboard, AWS ML Specialty." },
  { label: "Role alignment", score: 88, summary: "Closest themes: production ML systems, monitoring, deployment, and analytics delivery." },
];

const resumeSections = [
  {
    title: "Professional Summary",
    lines: [
      "Machine learning engineer with evidence-backed delivery across Python systems, model monitoring, and deployment workflows.",
      "Relevant experience combines production internship work with applied ML projects tailored to platform-focused roles.",
    ],
  },
  {
    title: "Core Skills",
    lines: [
      "Programming: Python, SQL",
      "Data & ML: Machine Learning, PyTorch, Forecasting, Model Monitoring",
      "Tools & Platforms: Git, Jupyter, AWS",
    ],
  },
  {
    title: "Relevant Experience",
    lines: [
      "Retail Forecasting Internship | Professional Experience",
      "- Built forecasting workflows in Python and shipped reporting dashboards for planning stakeholders.",
      "Machine Learning Engineer Capstone | Project",
      "- Designed monitoring workflows to catch drift and deployment regressions before they reached users.",
    ],
  },
];

const pathwayItems = [
  "Confirm extracted skills before matching to a role.",
  "Attach evidence so each skill is backed by real work.",
  "Review score breakdown and missing-skill coverage.",
  "Preview a tailored resume aligned to the target job.",
];

export function ExpoDemo() {
  const [activeView, setActiveView] = useState<DemoView>("skills");

  const activeTitle = useMemo(() => {
    switch (activeView) {
      case "skills":
        return "Confirmed skills with evidence support";
      case "evidence":
        return "Evidence organized around outcomes";
      case "match":
        return "Job match with readable scoring";
      case "resume":
        return "Tailored resume preview";
      default:
        return "SkillBridge demo";
    }
  }, [activeView]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#eff6ff_18%,_#f8fafc_42%,_#ffffff_100%)] px-3 py-3 text-slate-900 dark:bg-[radial-gradient(circle_at_top,_#0f172a_0%,_#020617_55%,_#020617_100%)] dark:text-slate-100 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-[1500px]">
        <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-3 shadow-[0_28px_90px_-30px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <img src={LogoImage} alt="SkillBridge Logo" className="h-10 w-auto scale-[2.1] object-contain sm:h-12" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Interactive Demo
                </div>
                <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">SkillBridge demo environment</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                  A single-page walkthrough that mirrors the real SkillBridge workflow for live presentations, QR scans, and booth demos.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1 dark:bg-slate-800 dark:text-slate-200">
                No login required
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1 dark:bg-slate-800 dark:text-slate-200">
                Stable demo data
              </Badge>
              <PublicThemeToggle />
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
            <aside className="space-y-4">
              <Card className="rounded-[1.7rem] border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Demo flow</p>
                <div className="mt-3 space-y-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const selected = item.key === activeView;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveView(item.key)}
                        className={`w-full rounded-[1.2rem] border px-3 py-3 text-left transition ${
                          selected
                            ? "border-[#1E3A8A] bg-[#1E3A8A] text-white shadow-lg"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`rounded-xl p-2 ${selected ? "bg-white/15" : "bg-slate-100 dark:bg-slate-800"}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold">{item.label}</p>
                            <p className={`mt-1 text-xs leading-5 ${selected ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
                              {item.note}
                            </p>
                          </div>
                          <ChevronRight className={`ml-auto mt-1 h-4 w-4 ${selected ? "text-white" : "text-slate-400"}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="rounded-[1.7rem] border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Persona</p>
                <h2 className="mt-2 text-lg font-bold">Jordan Builder</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Data Scientist to ML Engineer transition</p>
                <div className="mt-4 space-y-3">
                  {pathwayItems.map((item, index) => (
                    <div key={item} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#1E3A8A] text-xs font-bold text-white">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </aside>

            <main className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                {overviewCards.map((card) => (
                  <Card key={card.label} className="rounded-[1.6rem] border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{card.label}</p>
                    <div className="mt-2 text-3xl font-black tracking-tight">{card.value}</div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{card.detail}</p>
                  </Card>
                ))}
              </div>

              <Card className="rounded-[1.9rem] border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Live SkillBridge View</p>
                    <h2 className="mt-2 text-2xl font-bold">{activeTitle}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Tap the left navigation to move through the same skills, evidence, match, and resume story an attendee should understand in under a minute.
                    </p>
                  </div>
                  <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 dark:bg-slate-800 dark:text-slate-200">
                    Curated demo state
                  </Badge>
                </div>

                {activeView === "skills" ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {skillCards.map((skill) => (
                      <div key={skill.name} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{skill.name}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Hover behavior, evidence links, and manual corrections are represented here.</p>
                          </div>
                          <Badge className={`rounded-full ${skill.status === "Confirmed" ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}>
                            {skill.status}
                          </Badge>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{skill.proof}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {activeView === "evidence" ? (
                  <div className="mt-5 space-y-4">
                    {evidenceItems.map((item) => (
                      <div key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="font-semibold">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.type}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.skills.map((skill) => (
                              <Badge key={skill} variant="outline" className="rounded-full">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {activeView === "match" ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-[1.7rem] bg-[linear-gradient(135deg,_#1E3A8A,_#0F766E)] p-5 text-white">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-blue-100">Target Role</p>
                          <h3 className="mt-2 text-2xl font-bold">Machine Learning Engineer II</h3>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50">
                            Strong fit on production ML systems, monitoring, deployment support, and stakeholder-facing analytics work.
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-5xl font-black leading-none">87%</div>
                          <div className="mt-2 text-sm text-blue-100">Strong match</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                      {matchBreakdown.map((item) => (
                        <div key={item.label} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">{item.label}</p>
                            <span className="text-sm font-semibold text-[#1E3A8A] dark:text-amber-300">{item.score}%</span>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                            <div className="h-2 rounded-full bg-[#1E3A8A]" style={{ width: `${item.score}%` }} />
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeView === "resume" ? (
                  <div className="mt-5 rounded-[1.7rem] border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-inner dark:border-slate-800 dark:bg-slate-950">
                      <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
                        <p className="text-2xl font-bold">Jordan Builder</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Machine Learning Engineer Resume</p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          jordan@example.com | linkedin.com/in/jordan-builder | github.com/jordan-builder
                        </p>
                      </div>
                      <div className="mt-5 space-y-5">
                        {resumeSections.map((section) => (
                          <div key={section.title}>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{section.title}</p>
                            <div className="mt-2 space-y-2">
                              {section.lines.map((line) => (
                                <p key={line} className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                                  {line}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </Card>
            </main>

            <aside className="space-y-4">
              <Card className="rounded-[1.7rem] border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Target story</p>
                <h2 className="mt-2 text-xl font-bold">What attendees should understand</h2>
                <div className="mt-4 space-y-3">
                  {[
                    { icon: Award, text: "SkillBridge turns raw artifacts into a cleaner, proof-backed skills profile." },
                    { icon: TrendingUp, text: "The match view explains why a role scores well instead of hiding the reasoning." },
                    { icon: FileText, text: "The resume preview reflects the same evidence and job target in a compact format." },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.text} className="flex items-start gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                        <div className="rounded-xl bg-[#1E3A8A] p-2 text-white">
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item.text}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="rounded-[1.7rem] border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                    <PlayCircle className="h-5 w-5 text-[#1E3A8A] dark:text-amber-300" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Walkthrough Video</p>
                    <h2 className="mt-1 text-lg font-bold">Live demo companion</h2>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-slate-200 bg-slate-950 dark:border-slate-800">
                  <video className="aspect-video w-full" controls preload="metadata" playsInline>
                    <source src={demoVideoUrl} type="video/quicktime" />
                  </video>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Override with <code>VITE_EXPO_DEMO_VIDEO_URL</code> if you want the page to use a different hosted walkthrough.
                </p>
              </Card>

              <Card className="rounded-[1.7rem] border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Navigation</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild className="rounded-full bg-[#1E3A8A] hover:bg-[#1E3A8A]/90">
                    <Link to="/">Back to site</Link>
                  </Button>
                </div>
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
