import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { 
  Target, 
  Briefcase, 
  TrendingUp, 
  Zap, 
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import LogoSvg from "../../imports/file.svg";
import { PublicThemeToggle } from "../components/PublicThemeToggle";

export function Landing() {
  const currentYear = new Date().getFullYear();
  const features = [
    {
      icon: Target,
      title: "Smart Skill Management",
      description: "Organize and track your professional skills with AI-powered categorization and gap analysis.",
    },
    {
      icon: Briefcase,
      title: "Job Match Analysis",
      description: "Paste any job description and instantly see your match score with detailed breakdowns.",
    },
    {
      icon: TrendingUp,
      title: "Tailored Resumes",
      description: "Generate customized resumes optimized for specific job postings in seconds.",
    },
    {
      icon: Zap,
      title: "Portfolio Evidence",
      description: "Showcase your work with linked projects, certifications, and contributions.",
    },
  ];

  const benefits = [
    "AI-powered skill intelligence",
    "Real-time job matching",
    "Automated resume tailoring",
    "Portfolio management",
    "Gap analysis & recommendations",
    "Professional analytics dashboard",
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc,_#eef2ff_42%,_#ffffff)] dark:bg-[linear-gradient(180deg,_#020617,_#0f172a_42%,_#020617)]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/70 bg-white/75 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center rounded-2xl px-1 py-1 transition-opacity hover:opacity-90">
              <img src={LogoSvg} alt="SkillBridge Logo" className="h-16 w-auto max-w-[280px] object-contain" />
            </Link>
            <div className="flex items-center gap-4">
              <div className="hidden sm:block">
                <PublicThemeToggle />
              </div>
              <Button variant="ghost" asChild className="hidden text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white sm:inline-flex">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90">
                <Link to="/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-16 sm:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/65 dark:text-slate-300">
              Career Intelligence Platform
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-tight text-gray-900 dark:text-slate-50 sm:text-5xl md:text-6xl">
              Turn your experience into
              <span className="text-[#1E3A8A]"> proof, alignment, and momentum.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-slate-300">
              SkillBridge helps you organize skills, connect evidence, analyze job fit, and generate tailored resume outputs with backend-local intelligence.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Button size="lg" asChild className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90 w-full sm:w-auto">
                <Link to="/signup">
                  Create Free Account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full border-slate-200 bg-white/80 text-slate-700 hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/65 dark:text-slate-100 dark:hover:bg-slate-900 dark:hover:text-white sm:w-auto">
                <Link to="/login">Login</Link>
              </Button>
            </div>
            <div className="mt-6 sm:hidden">
              <PublicThemeToggle />
            </div>
          </div>

          <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(135deg,_rgba(30,58,138,0.98),_rgba(15,118,110,0.95))] p-0 text-white shadow-xl">
            <div className="space-y-5 px-6 py-6 sm:px-7 sm:py-7">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-blue-100">Product Snapshot</div>
                <h2 className="mt-3 text-2xl font-semibold leading-tight">A dashboard built around proof, gaps, and next actions.</h2>
              </div>

              <div className="rounded-[1.75rem] border border-white/15 bg-slate-950/20 p-4 shadow-inner">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-blue-100/80">Welcome back</p>
                    <p className="mt-1 text-lg font-semibold">Your Career Dashboard</p>
                  </div>
                  <div className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-3 py-1 text-xs font-medium text-emerald-100">
                    Updated today
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-blue-100/80">Total Skills</div>
                    <div className="mt-2 text-2xl font-bold">24</div>
                    <div className="mt-1 text-xs text-blue-100">18 confirmed, 6 need proof</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-blue-100/80">Match Score</div>
                    <div className="mt-2 text-2xl font-bold">82%</div>
                    <div className="mt-1 text-xs text-blue-100">Frontend Engineer role</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Recent Activity</p>
                      <span className="text-xs text-blue-100/80">Live</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-xl bg-white/8 px-3 py-2 text-sm text-blue-50">Uploaded internship report and extracted 5 skills</div>
                      <div className="rounded-xl bg-white/8 px-3 py-2 text-sm text-blue-50">Reanalyzed Product Analyst posting</div>
                      <div className="rounded-xl bg-white/8 px-3 py-2 text-sm text-blue-50">Generated tailored resume PDF</div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-sm font-semibold">Coverage Snapshot</p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-blue-100/80">
                          <span>Required skills covered</span>
                          <span>7 / 9</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div className="h-2 w-[78%] rounded-full bg-emerald-300" />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-blue-100/80">
                          <span>Evidence-backed skills</span>
                          <span>14 / 18</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div className="h-2 w-[72%] rounded-full bg-sky-300" />
                        </div>
                      </div>
                      <div className="rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs text-amber-50">
                        Missing evidence for SQL, A/B testing, and stakeholder communication.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div className="text-center">
            <div className="text-4xl font-bold text-[#1E3A8A]">Evidence-Backed</div>
            <div className="mt-2 text-gray-600 dark:text-slate-300">Skills Tied to Real Work</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-[#0D9488]">Job-Specific</div>
            <div className="mt-2 text-gray-600 dark:text-slate-300">Match and Gap Analysis</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-[#1E3A8A]">Local AI</div>
            <div className="mt-2 text-gray-600 dark:text-slate-300">Private Analysis Pipeline</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-16 dark:bg-slate-950/40 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-slate-50 sm:text-4xl">
              Everything You Need to Land Your Dream Job
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-gray-600 dark:text-slate-300">
              Professional tools designed for modern job seekers and career professionals
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-slate-200 bg-white/90 p-8 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-blue-50 p-3 dark:bg-slate-900/80">
                    <feature.icon className="h-6 w-6 text-[#1E3A8A]" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-slate-100">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-slate-300">{feature.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="mb-6 text-3xl font-bold text-gray-900 dark:text-slate-50 sm:text-4xl">
                Why Choose SkillBridge?
              </h2>
              <p className="mb-8 text-lg text-gray-600 dark:text-slate-300">
                Built for recruiters, employers, and technical professionals who demand 
                intelligent, data-driven career tools.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#0D9488] flex-shrink-0" />
                    <span className="text-gray-700 dark:text-slate-200">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <Card className="border-none bg-gradient-to-br from-[#1E3A8A] to-[#0D9488] p-8 text-white shadow-xl">
                <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
                <p className="mb-6 text-blue-100">
                  Join thousands of professionals who have transformed their job search 
                  with SkillBridge's intelligent platform.
                </p>
                <Button size="lg" asChild className="bg-white text-[#1E3A8A] hover:bg-gray-100 w-full sm:w-auto">
                  <Link to="/signup">
                    Create Your Account
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-950/40 sm:py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-slate-50 sm:text-4xl">
            Start Your Journey Today
          </h2>
          <p className="mb-8 text-xl text-gray-600 dark:text-slate-300">
            No credit card required. Get started in less than 2 minutes.
          </p>
          <Button size="lg" asChild className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90">
            <Link to="/signup">
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50/80 py-10 dark:border-slate-800 dark:bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-md">
              <img src={LogoSvg} alt="SkillBridge Logo" className="h-12 w-auto max-w-[220px] object-contain" />
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                SkillBridge helps professionals organize evidence, validate skills, and understand job fit with local intelligence.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:gap-6">
              <Link to="/login" className="transition-colors hover:text-slate-900 dark:hover:text-white">
                Login
              </Link>
              <Link to="/signup" className="transition-colors hover:text-slate-900 dark:hover:text-white">
                Get Started
              </Link>
              <a href="mailto:support@skillbridge.app" className="transition-colors hover:text-slate-900 dark:hover:text-white">
                Contact
              </a>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© {currentYear} SkillBridge. All rights reserved.</p>
            <p>Built for deployment-ready skill verification, evidence management, and job-match analysis.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
