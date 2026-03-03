import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { User, Mail, Lock, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useActivity } from "../context/ActivityContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";

export function Account() {
  const { recordActivity } = useActivity();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [aiStatus, setAiStatus] = useState<any>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [me, status] = await Promise.all([
          api.me(),
          api.getAISettingsStatus().catch(() => null),
        ]);
        setUsername(me?.username || "");
        setEmail(me?.email || "");
        setAiStatus(status);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load account");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const initials = useMemo(() => {
    const u = (username || "").trim();
    if (!u) return "SB";
    const parts = u.split(/[\s._-]+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "S";
    const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "B";
    return (a + b).toUpperCase();
  }, [username]);

  const handleUpdateUsername = async () => {
    setSavingProfile(true);
    try {
      await api.patchMe({ username: username || undefined });
      recordActivity({
        id: "account:username",
        type: "account",
        action: "updated",
        name: "Username updated",
      });
      toast.success("Username updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update username");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateEmail = async () => {
    setSavingProfile(true);
    try {
      await api.patchMe({ email: email || undefined });
      recordActivity({
        id: "account:email",
        type: "account",
        action: "updated",
        name: "Email updated",
      });
      toast.success("Email updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update email");
    } finally {
      setSavingProfile(false);
    }
  };

  // NOTE: Your backend patch_me currently supports username/email. It does NOT change password.
  // Keep this UI as a stub until you add a password-change endpoint.
  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    toast.error("Password change is not implemented on the backend yet");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      api.clearToken();
      // ✅ redirect to landing page
      window.location.href = "/";
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.deleteAccount();
      toast.success("Account deleted");
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete account");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-8">
          <div className="text-gray-500">Loading account...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Card */}
      <Card className="p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-[#1E3A8A] flex items-center justify-center text-white text-2xl font-bold">
            {initials}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{username || "Account"}</h2>
            <p className="text-gray-600">{email || ""}</p>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-6">
          {/* Username Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-[#1E3A8A]" />
              <h3 className="text-lg font-semibold text-gray-900">Username</h3>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleUpdateUsername}
                  disabled={savingProfile}
                  className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
                >
                  Update
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Email Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-[#1E3A8A]" />
              <h3 className="text-lg font-semibold text-gray-900">Email Address</h3>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleUpdateEmail}
                  disabled={savingProfile}
                  className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
                >
                  Update
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI Settings</h3>
            <p className="mt-1 text-sm text-gray-600">Current local backend inference mode used for Job Match semantic analysis, evidence extraction, and bullet enhancement.</p>
            <div className="mt-4 rounded-xl border border-gray-200 bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Mode</p>
                  <p className="mt-1 font-medium text-gray-900">{aiStatus?.provider_mode ?? "Unavailable"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Embeddings</p>
                  <p className="mt-1 font-medium text-gray-900">{aiStatus?.embeddings_provider ?? "Unavailable"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Embedding Model</p>
                  <p className="mt-1 font-medium text-gray-900">{aiStatus?.embedding_model ?? "Unavailable"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Rewrite Provider</p>
                  <p className="mt-1 font-medium text-gray-900">{aiStatus?.rewrite_provider ?? "Unavailable"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Rewrite Model</p>
                  <p className="mt-1 font-medium text-gray-900">{aiStatus?.rewrite_model ?? "Unavailable"}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Password Section (stub until backend exists) */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-[#1E3A8A]" />
              <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <Button
                onClick={handleChangePassword}
                className="bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
              >
                Change Password
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Actions Card */}
      <Card className="p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Account Actions</h3>

        <div className="space-y-4">
          {/* Logout */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3">
              <LogOut className="h-5 w-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Logout</p>
                <p className="text-sm text-gray-600">Sign out of your account</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>

          {/* Delete Account */}
          <div className="border border-red-200 bg-red-50 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-red-600 mt-1" />
                <div>
                  <p className="font-medium text-red-900">Danger Zone</p>
                  <p className="text-sm text-red-700 mt-1">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="ml-4">
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account and remove all your data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Yes, delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-[#1E3A8A]">Note:</span> Your data is securely stored and encrypted.
        </p>
      </Card>
    </div>
  );
}
