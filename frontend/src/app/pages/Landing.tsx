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

export function Landing() {
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
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={LogoSvg} alt="SkillBridge Logo" className="h-8 w-8" />
              <span className="text-2xl font-bold text-[#1E3A8A]">SkillBridge</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
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
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            AI-Powered Resume
            <span className="text-[#1E3A8A]"> Intelligence</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto px-4">
            Transform your job search with intelligent skill matching, automated resume tailoring, 
            and data-driven career insights.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" asChild className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90 w-full sm:w-auto">
              <Link to="/signup">
                Create Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link to="/login">Login</Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-16 sm:mt-20">
          <div className="text-center">
            <div className="text-4xl font-bold text-[#1E3A8A]">87%</div>
            <div className="text-gray-600 mt-2">Average Match Score</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-[#0D9488]">2.5x</div>
            <div className="text-gray-600 mt-2">Faster Applications</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-[#1E3A8A]">10k+</div>
            <div className="text-gray-600 mt-2">Resumes Generated</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Land Your Dream Job
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Professional tools designed for modern job seekers and career professionals
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-8 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <feature.icon className="h-6 w-6 text-[#1E3A8A]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600">{feature.description}</p>
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
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Why Choose SkillBridge?
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Built for recruiters, employers, and technical professionals who demand 
                intelligent, data-driven career tools.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[#0D9488] flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <Card className="p-8 bg-gradient-to-br from-[#1E3A8A] to-[#0D9488] text-white">
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
      <section className="bg-white border-t py-16 sm:py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Start Your Journey Today
          </h2>
          <p className="text-xl text-gray-600 mb-8">
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
      <footer className="border-t bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={LogoSvg} alt="SkillBridge Logo" className="h-8 w-8" />
              <span className="text-lg font-bold text-[#1E3A8A]">SkillBridge</span>
            </div>
            <p className="text-gray-600 text-sm text-center sm:text-left">
              © 2026 SkillBridge. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
