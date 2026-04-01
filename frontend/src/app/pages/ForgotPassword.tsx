import { useState } from "react";
import { Link } from "react-router";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../services/api";
import LogoImage from "../../imports/skillbridge_logo.png";
import { PublicThemeToggle } from "../components/PublicThemeToggle";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your account email.");
      return;
    }
    setLoading(true);
    try {
      await api.requestPasswordReset({ email: email.trim() });
      setSubmitted(true);
    } catch (_error) {
      toast.error("Password reset is unavailable right now.");
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
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-slate-50">Reset your password</h1>
          <p className="text-gray-600 dark:text-slate-300">
            We&apos;ll prepare a reset link so you can recover your account without losing your workspace.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-5">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/90 p-5 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-500/20">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span className="font-semibold">Reset request recorded</span>
              </div>
              If that email is registered, a password reset link is now available. Check your inbox or ask an admin to confirm outbound email is configured in production.
            </div>
            <Button asChild className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-slate-800 dark:text-slate-200">Email Address</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing reset link...
                </>
              ) : (
                "Send reset link"
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
