import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Loader2, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../services/api";
import LogoImage from "../../imports/skillbridge_logo.png";
import { PublicThemeToggle } from "../components/PublicThemeToggle";

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [formData, setFormData] = useState({ password: "", confirmPassword: "" });
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      toast.error("This reset link is invalid.");
      return;
    }
    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.confirmPasswordReset({ token, new_password: formData.password });
      setCompleted(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc,_#eef2ff_45%,_#ffffff)] dark:bg-[linear-gradient(180deg,_#020617,_#0f172a_45%,_#020617)] flex items-center justify-center p-4">
      <div className="fixed right-4 top-4 z-20">
        <PublicThemeToggle />
      </div>
      <Card className="w-full max-w-md border-slate-200 bg-white/95 p-8 shadow-xl dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <img src={LogoImage} alt="SkillBridge Logo" className="h-20 w-auto max-w-[240px] scale-[2.6] object-contain" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-slate-50">Choose a new password</h1>
          <p className="text-gray-600 dark:text-slate-300">
            Set a new password for your SkillBridge account and sign back in when you&apos;re done.
          </p>
        </div>

        {!token ? (
          <div className="space-y-5">
            <div className="rounded-3xl border border-amber-200 bg-amber-50/90 p-5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-full bg-amber-100 p-2 dark:bg-amber-500/20">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <span className="font-semibold">Reset link missing</span>
              </div>
              Request a new password reset link and open it directly from the email so the token is preserved.
            </div>
            <Button asChild className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90">
              <Link to="/forgot-password">Request new link</Link>
            </Button>
          </div>
        ) : completed ? (
          <div className="space-y-5">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/90 p-5 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-500/20">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span className="font-semibold">Password updated</span>
              </div>
              Your password has been changed and any older sessions were signed out for safety.
            </div>
            <Button
              className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
              onClick={() => navigate("/login")}
            >
              Return to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="password" className="text-slate-800 dark:text-slate-200">New Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-slate-800 dark:text-slate-200">Confirm Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat your new password"
                  value={formData.confirmPassword}
                  onChange={(event) => setFormData((current) => ({ ...current, confirmPassword: event.target.value }))}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting password...
                </>
              ) : (
                "Save new password"
              )}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-[#1E3A8A] hover:underline dark:text-blue-400">
            ← Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
