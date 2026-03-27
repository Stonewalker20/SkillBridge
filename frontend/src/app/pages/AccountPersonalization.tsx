import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Lock, MonitorCog, Palette, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { useHeaderTheme } from "../lib/headerTheme";
import { useAccountPreferences, SIDEBAR_DENSITY_OPTIONS, START_PAGE_OPTIONS } from "../context/AccountPreferencesContext";
import { AVATAR_PRESETS, avatarPresetClass, type AvatarPresetValue } from "../lib/avatarPresets";
import { api, type RewardsSummary } from "../services/api";
import { AccountSectionNav } from "../components/AccountSectionNav";
import { RewardBadgeCollection } from "../components/RewardBadgeCollection";
import { highestUnlockedRewardTier, rewardTierAtLeast, rewardTierClasses, rewardTierLabel } from "../lib/rewardTiers";

function PreferenceRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-1" />
    </div>
  );
}

export function AccountPersonalization() {
  const { refreshUser } = useAuth();
  const { recordActivity } = useActivity();
  const { headerTheme, setHeaderTheme, activeHeaderTheme, themes } = useHeaderTheme();
  const { preferences, updatePreferences, resetPreferences } = useAccountPreferences();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreset, setAvatarPreset] = useState<string | null>("midnight");
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [meResult, rewardsResult] = await Promise.allSettled([api.me(), api.getRewardsSummary()]);
        if (meResult.status === "fulfilled") {
          const me = meResult.value;
          setUsername(me?.username || "");
          setEmail(me?.email || "");
          setAvatarUrl(me?.avatar_url || null);
          setAvatarPreset(me?.avatar_preset || "midnight");
        } else {
          toast.error(meResult.reason?.message || "Failed to load personalization");
        }
        setRewards(rewardsResult.status === "fulfilled" ? rewardsResult.value : null);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load personalization");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const initials = useMemo(() => {
    const raw = (username || "").trim();
    if (!raw) return "SB";
    const parts = raw.split(/[\s._-]+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "S";
    const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "B";
    return (a + b).toUpperCase();
  }, [username]);

  const themeSummary = useMemo(() => {
    if (theme === "system") {
      return `System (${resolvedTheme === "dark" ? "dark" : "light"})`;
    }
    return theme === "dark" ? "Dark" : "Light";
  }, [resolvedTheme, theme]);

  const startPageLabel =
    START_PAGE_OPTIONS.find((option) => option.value === preferences.startPage)?.label ?? "Dashboard";
  const densityLabel =
    SIDEBAR_DENSITY_OPTIONS.find((option) => option.value === preferences.sidebarDensity)?.label ?? "Comfortable";
  const hasRewardsData = Boolean(
    rewards &&
      ((rewards.badges?.length ?? 0) > 0 ||
        rewards.achievements.length > 0 ||
        (rewards.badgeCount ?? 0) > 0 ||
        (rewards.totalCount ?? 0) > 0)
  );
  const highestTier = hasRewardsData
    ? highestUnlockedRewardTier(
        (rewards?.badges ?? rewards?.achievements ?? []).filter((badge) => badge.unlocked).map((badge) => badge.current_tier ?? badge.tier)
      )
    : null;
  const unlockedThemeCount = themes.filter((themeOption) => rewardTierAtLeast(highestTier, themeOption.unlockTier)).length;
  const unlockedAvatarPresetCount = AVATAR_PRESETS.filter((preset) => rewardTierAtLeast(highestTier, preset.unlockTier)).length;

  const handleSelectAvatarPreset = async (preset: AvatarPresetValue) => {
    try {
      const updated = await api.patchMe({ avatar_preset: preset });
      setAvatarPreset(updated.avatar_preset || preset);
      setAvatarUrl(updated.avatar_url || null);
      await refreshUser();
      toast.success("Profile icon updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update profile icon");
    }
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const updated = await api.uploadMyAvatar(file);
      setAvatarUrl(updated.avatar_url || null);
      setAvatarPreset(updated.avatar_preset || null);
      await refreshUser();
      toast.success("Profile photo updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to upload profile photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleResetPersonalization = () => {
    resetPreferences();
    setTheme("system");
    recordActivity({
      id: `account:personalization:${Date.now()}`,
      type: "account",
      action: "reset",
      name: "Workspace preferences reset",
    });
    toast.success("Workspace preferences reset");
  };

  const handleSelectTheme = (themeValue: (typeof themes)[number]["value"], isLocked: boolean) => {
    if (isLocked) {
      toast("Unlock a higher badge tier to use this colorway.");
      return;
    }
    setHeaderTheme(themeValue);
  };

  if (loading) {
    return (
      <div className="max-w-6xl space-y-6">
        <AccountSectionNav />
        <Card className="border-slate-200 p-8 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-gray-500 dark:text-slate-400">Loading personalization...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <AccountSectionNav />

      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-6 py-6 md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 shadow-sm ring-4 ring-white/70 dark:ring-slate-950/50">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={`${username || "Account"} avatar`} /> : null}
                <AvatarFallback className={`text-2xl font-bold ${avatarPresetClass(avatarPreset) ?? activeHeaderTheme.avatarClass} text-white`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  Personalization
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Tune your workspace
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Colors, avatar style, dashboard modules, and navigation defaults for {email || username || "your account"}.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Theme</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{themeSummary}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Start Page</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{startPageLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Sidebar</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{densityLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Avatar</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{avatarUrl ? "Uploaded photo" : avatarPreset || "Preset"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-2xl p-2.5 ${activeHeaderTheme.softPanelClass}`}>
                  <Palette className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Workspace Colors</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Pick a theme visually and see the matching avatar accent before selecting it.
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleResetPersonalization}>
                Reset
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="theme-mode">Theme Mode</Label>
                <Select value={theme ?? "system"} onValueChange={(value) => setTheme(value)}>
                  <SelectTrigger id="theme-mode" className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                    <SelectValue placeholder="Select theme mode" />
                  </SelectTrigger>
                  <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sidebar-density">Sidebar Density</Label>
                <Select
                  value={preferences.sidebarDensity}
                  onValueChange={(value) => updatePreferences({ sidebarDensity: value as typeof preferences.sidebarDensity })}
                >
                  <SelectTrigger id="sidebar-density" className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                    <SelectValue placeholder="Select sidebar density" />
                  </SelectTrigger>
                  <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    {SIDEBAR_DENSITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
              {hasRewardsData
                ? `${unlockedThemeCount}/${themes.length} header themes and ${unlockedAvatarPresetCount}/${AVATAR_PRESETS.length} avatar colorways are available. Highest unlocked tier: ${rewardTierLabel(highestTier)}.`
                : "Achievement sync is unavailable right now, so all header themes remain selectable until badge progress reloads."}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {themes.map((themeOption) => {
                const isSelected = headerTheme === themeOption.value;
                const isLocked = hasRewardsData && !rewardTierAtLeast(highestTier, themeOption.unlockTier) && !isSelected;
                const tierClass = rewardTierClasses(themeOption.unlockTier);
                return (
                  <button
                    key={themeOption.value}
                    type="button"
                    onClick={() => handleSelectTheme(themeOption.value, isLocked)}
                    disabled={isLocked}
                    className={`rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? "border-slate-900 bg-slate-50 shadow-sm dark:border-slate-100 dark:bg-slate-900"
                        : isLocked
                          ? "border-slate-200 bg-white/70 opacity-70 dark:border-slate-800 dark:bg-slate-950/40"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/70 dark:hover:border-slate-500"
                    }`}
                    aria-pressed={isSelected}
                    aria-label={`Use ${themeOption.label}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {themeOption.swatchColors.map((color) => (
                          <span
                            key={color}
                            className="h-5 w-5 rounded-full border border-white/70 shadow-sm dark:border-slate-900"
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                      <span
                        className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border ${
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                            : "border-slate-300 text-transparent dark:border-slate-600"
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="min-w-0 text-sm font-semibold text-slate-900 dark:text-slate-100">{themeOption.label}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {themeOption.unlockTier ? (
                          <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${isLocked ? tierClass.muted : tierClass.chip}`}>
                            {rewardTierLabel(themeOption.unlockTier)}
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                            Starter
                          </span>
                        )}
                        {isLocked ? (
                          <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        ) : null}
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${themeOption.avatarClass} text-white`}>
                          {initials}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-5 flex items-center gap-3">
              <div className={`rounded-2xl p-2.5 ${activeHeaderTheme.softPanelClass}`}>
                <MonitorCog className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Workspace Behavior</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Choose where you land first and which dashboard modules stay visible.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="start-page">Start Page</Label>
                <Select
                  value={preferences.startPage}
                  onValueChange={(value) => updatePreferences({ startPage: value as typeof preferences.startPage })}
                >
                  <SelectTrigger id="start-page" className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                    <SelectValue placeholder="Select start page" />
                  </SelectTrigger>
                  <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    {START_PAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <PreferenceRow
                title="Reduce motion"
                description="Tone down transitions and motion-heavy UI changes."
                checked={preferences.reducedMotion}
                onCheckedChange={(value) => updatePreferences({ reducedMotion: value })}
              />
              <PreferenceRow
                title="Show quick actions"
                description="Keep sidebar shortcuts visible for faster navigation."
                checked={preferences.showQuickActions}
                onCheckedChange={(value) => updatePreferences({ showQuickActions: value })}
              />
              <PreferenceRow
                title="Show welcome hero"
                description="Keep the dashboard introduction panel visible."
                checked={preferences.showWelcomeHero}
                onCheckedChange={(value) => updatePreferences({ showWelcomeHero: value })}
              />
              <PreferenceRow
                title="Show recent activity"
                description="Display the recent activity feed on the dashboard."
                checked={preferences.showRecentActivity}
                onCheckedChange={(value) => updatePreferences({ showRecentActivity: value })}
              />
              <PreferenceRow
                title="Show evidence insights"
                description="Display analytics and evidence mix cards."
                checked={preferences.showPortfolioInsights}
                onCheckedChange={(value) => updatePreferences({ showPortfolioInsights: value })}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {rewards ? (
            <RewardBadgeCollection
              badges={rewards.badges ?? rewards.achievements}
              unlockedCount={rewards.unlockedBadgeCount ?? rewards.unlockedCount}
              totalCount={rewards.badgeCount ?? rewards.totalCount ?? rewards.achievements.length}
            />
          ) : (
            <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Badge progress is unavailable right now, but your personalization settings are still available.
              </div>
            </Card>
          )}

          <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-5 flex items-center gap-3">
              <div className={`rounded-2xl p-2.5 ${activeHeaderTheme.softPanelClass}`}>
                <Upload className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Profile Icon</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Upload a photo or choose a preset color. Photos are center-cropped so they stay proportional.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={`${username || "Account"} avatar preview`} /> : null}
                  <AvatarFallback className={`text-lg font-bold ${avatarPresetClass(avatarPreset) ?? activeHeaderTheme.avatarClass} text-white`}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Profile photo</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">PNG, JPG, JPEG, and WEBP up to 5 MB.</p>
                </div>
              </div>

              <Input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                className="mt-4 bg-white dark:bg-slate-950/70"
                disabled={uploadingAvatar}
                onChange={(event) => {
                  handleAvatarUpload(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                {AVATAR_PRESETS.map((preset) => {
                  const selected = !avatarUrl && avatarPreset === preset.value;
                  const isLocked = hasRewardsData && !rewardTierAtLeast(highestTier, preset.unlockTier) && !selected;
                  const tierClass = rewardTierClasses(preset.unlockTier);
                  return (
                    <button
                      type="button"
                      key={preset.value}
                      onClick={() => {
                        if (isLocked) {
                          toast("Unlock a higher badge tier to use this colorway.");
                          return;
                        }
                        handleSelectAvatarPreset(preset.value);
                      }}
                      disabled={isLocked}
                      className={`rounded-2xl border p-3 text-left transition ${
                        selected
                          ? "border-slate-900 bg-white shadow-sm dark:border-slate-100 dark:bg-slate-900"
                          : isLocked
                            ? "border-slate-200 bg-white/70 opacity-70 dark:border-slate-700 dark:bg-slate-950/50"
                            : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${preset.className}`}>
                        {initials}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{preset.label}</div>
                        {preset.unlockTier ? (
                          <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${isLocked ? tierClass.muted : tierClass.chip}`}>
                            {rewardTierLabel(preset.unlockTier)}
                          </span>
                        ) : null}
                        {isLocked ? (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                            Locked
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-5 flex items-center gap-3">
              <div className={`rounded-2xl p-2.5 ${activeHeaderTheme.softPanelClass}`}>
                <Sparkles className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Current Setup</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">A quick summary of your active account personalization.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Theme + Header</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {themeSummary} with the {themes.find((item) => item.value === headerTheme)?.label ?? "current"} header style
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Navigation</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {startPageLabel} is your start page, with a {densityLabel.toLowerCase()} sidebar.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Dashboard Focus</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {preferences.showRecentActivity ? "Recent activity visible" : "Recent activity hidden"} and {preferences.showPortfolioInsights ? "analytics cards visible" : "analytics cards hidden"}.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
