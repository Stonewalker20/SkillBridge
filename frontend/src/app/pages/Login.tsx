import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Mail, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import LogoSvg from "../../imports/file.svg";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await login(formData.email, formData.password);
      toast.success("Welcome back!");
      navigate("/app");
    } catch (error) {
      toast.error("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc,_#eef2ff_45%,_#ffffff)] flex items-center justify-center p-4">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="hidden lg:flex flex-col justify-between rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_rgba(30,58,138,0.98),_rgba(15,118,110,0.95))] p-8 text-white shadow-xl">
          <div>
            <img src={LogoSvg} alt="SkillBridge Logo" className="h-14 w-auto max-w-[180px] object-contain" />
            <h1 className="mt-8 text-4xl font-bold leading-tight">Return to your skill intelligence workspace.</h1>
            <p className="mt-4 text-base leading-7 text-blue-100">
              Review evidence, analyze job fit, and keep your professional profile aligned without losing momentum.
            </p>
          </div>
          <div className="space-y-3 text-sm text-blue-50">
            <div className="rounded-2xl bg-white/10 px-4 py-3">Evidence-backed skills and job-match insights in one place.</div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">Tailored resume generation tied directly to your saved work.</div>
          </div>
        </div>

      <Card className="w-full max-w-md border-slate-200 p-8 shadow-xl lg:max-w-none">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src={LogoSvg} alt="SkillBridge Logo" className="h-16 w-auto max-w-[200px] object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your SkillBridge account</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Don't have an account?</span>
          </div>
        </div>

        {/* Sign Up Link */}
        <Button variant="outline" asChild className="w-full">
          <Link to="/signup">Create Account</Link>
        </Button>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-[#1E3A8A] hover:underline">
            ← Back to Home
          </Link>
        </div>
      </Card>
      </div>
    </div>
  );
}
