import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { User, Mail, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import LogoImage from "../../imports/skillbridge_logo.png";
import { PublicThemeToggle } from "../components/PublicThemeToggle";

export function SignUp() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await signup(formData.username, formData.email, formData.password);
      setShowSuccessDialog(true);
    } catch (_error) {
      toast.error("Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessDialog(false);
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc,_#eef2ff_45%,_#ffffff)] dark:bg-[linear-gradient(180deg,_#020617,_#0f172a_45%,_#020617)] flex items-center justify-center p-4">
      <div className="fixed right-4 top-4 z-20">
        <PublicThemeToggle />
      </div>
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="hidden lg:flex flex-col justify-between rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_rgba(30,58,138,0.98),_rgba(245,158,11,0.94))] p-8 text-white shadow-xl">
          <div>
            <h1 className="mt-8 text-4xl font-bold leading-tight">Build a profile that can prove what you know.</h1>
            <p className="mt-4 text-base leading-7 text-blue-100">
              Create your workspace, add evidence, confirm skills, and generate targeted job-match outputs from a single profile.
            </p>
          </div>
          <div className="space-y-3 text-sm text-blue-50">
            <div className="rounded-2xl bg-white/10 px-4 py-3">Organize skills across projects, resumes, and uploaded evidence.</div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">See coverage gaps before you apply and tailor faster.</div>
          </div>
        </div>

      <Card className="w-full max-w-md border-slate-200 bg-white/95 p-8 shadow-xl dark:border-slate-800 dark:bg-slate-950/85 lg:max-w-none">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src={LogoImage} alt="SkillBridge Logo" className="h-20 w-auto max-w-[240px] scale-[2.6] object-contain" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-slate-50">Create Account</h1>
          <p className="text-gray-600 dark:text-slate-300">Join SkillBridge and transform your job search</p>
        </div>

        {/* Sign Up Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="username" className="text-slate-800 dark:text-slate-200">Username</Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-slate-500" />
              <Input
                id="username"
                type="text"
                placeholder="john_doe"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="text-slate-800 dark:text-slate-200">Email Address</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-slate-500" />
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
            <Label htmlFor="password" className="text-slate-800 dark:text-slate-200">Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-slate-500" />
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-slate-800 dark:text-slate-200">Confirm Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-slate-500" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
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
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500 dark:bg-slate-950 dark:text-slate-400">Already have an account?</span>
          </div>
        </div>

        {/* Login Link */}
        <Button variant="outline" asChild className="w-full">
          <Link to="/login">Sign In</Link>
        </Button>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-[#1E3A8A] hover:underline dark:text-blue-400">
            ← Back to Home
          </Link>
        </div>
      </Card>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 p-3 dark:bg-emerald-500/15">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl dark:text-slate-50">Account Created Successfully!</DialogTitle>
            <DialogDescription className="pt-2 text-center text-base dark:text-slate-300">
              Welcome to SkillBridge! Your account has been created and you're now logged in.
              Let's get started with building your professional profile.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button 
              onClick={handleSuccessClose}
              className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
            >
              Go to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
