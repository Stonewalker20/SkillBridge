import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { ChevronDown, Lock, MonitorCog, Palette, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { getHeaderThemeSoftPanelClass, useHeaderTheme } from "../lib/headerTheme";
import {
  GRADIENT_MODE_OPTIONS,
  PANEL_STYLE_OPTIONS,
  SIDEBAR_ITEM_OPTIONS,
  START_PAGE_OPTIONS,
  useAccountPreferences,
  type SidebarItemValue,
} from "../context/AccountPreferencesContext";
import { AVATAR_PRESETS, avatarPresetClass, type AvatarPresetValue } from "../lib/avatarPresets";
import { api, type RewardsSummary } from "../services/api";
import { AccountSectionNav } from "../components/AccountSectionNav";
import {
  REWARD_TIERS,
  highestUnlockedRewardTier,
  isTierUnlockableUnlocked,
  rewardTierClasses,
  rewardTierLabel,
  unlockableCountForTier,
  type RewardTier,
} from "../lib/rewardTiers";

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

function CollapsibleSettingsCard({
  title,
  description,
  summary,
  icon,
  actions,
  children,
  defaultOpen = false,
}: {
  title: string;
  description: string;
  summary: string;
  icon: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {icon}
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-start">
            {actions}
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="[&[data-state=open]>svg]:rotate-180"
                aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
              >
                {open ? "Collapse" : "Expand"}
                <ChevronDown className="ml-2 h-4 w-4 transition-transform duration-200" />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="pt-4">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

const AVATAR_CROP_SIZE = 320;
const AVATAR_EXPORT_SIZE = 512;

type AvatarCropState = {
  file: File;
  previewUrl: string;
  imageWidth: number;
  imageHeight: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function coveredImageDimensions(imageWidth: number, imageHeight: number, zoom: number) {
  const safeWidth = Math.max(1, imageWidth);
  const safeHeight = Math.max(1, imageHeight);
  const baseScale = Math.max(AVATAR_CROP_SIZE / safeWidth, AVATAR_CROP_SIZE / safeHeight);
  const scaledWidth = safeWidth * baseScale * zoom;
  const scaledHeight = safeHeight * baseScale * zoom;
  return { scaledWidth, scaledHeight };
}

function clampAvatarOffset(axisOffset: number, scaledSize: number) {
  const slack = Math.max(0, (scaledSize - AVATAR_CROP_SIZE) / 2);
  return clamp(axisOffset, -slack, slack);
}

async function loadImageDimensions(file: File) {
  const previewUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Failed to load image preview"));
      nextImage.src = previewUrl;
    });
    return {
      previewUrl,
      imageWidth: image.naturalWidth || image.width || AVATAR_CROP_SIZE,
      imageHeight: image.naturalHeight || image.height || AVATAR_CROP_SIZE,
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

async function buildCroppedAvatarFile(
  crop: AvatarCropState,
  zoom: number,
  offsetX: number,
  offsetY: number
) {
  const { scaledWidth, scaledHeight } = coveredImageDimensions(crop.imageWidth, crop.imageHeight, zoom);
  const clampedOffsetX = clampAvatarOffset(offsetX, scaledWidth);
  const clampedOffsetY = clampAvatarOffset(offsetY, scaledHeight);
  const destinationX = (AVATAR_EXPORT_SIZE - scaledWidth * (AVATAR_EXPORT_SIZE / AVATAR_CROP_SIZE)) / 2 + clampedOffsetX * (AVATAR_EXPORT_SIZE / AVATAR_CROP_SIZE);
  const destinationY = (AVATAR_EXPORT_SIZE - scaledHeight * (AVATAR_EXPORT_SIZE / AVATAR_CROP_SIZE)) / 2 + clampedOffsetY * (AVATAR_EXPORT_SIZE / AVATAR_CROP_SIZE);
  const drawWidth = scaledWidth * (AVATAR_EXPORT_SIZE / AVATAR_CROP_SIZE);
  const drawHeight = scaledHeight * (AVATAR_EXPORT_SIZE / AVATAR_CROP_SIZE);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_EXPORT_SIZE;
  canvas.height = AVATAR_EXPORT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to prepare the resized profile image");
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Failed to render image"));
    nextImage.src = crop.previewUrl;
  });

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, destinationX, destinationY, drawWidth, drawHeight);

  const outputType = crop.file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Failed to export the resized profile image"));
    }, outputType, outputType === "image/jpeg" ? 0.92 : undefined);
  });

  const baseName = crop.file.name.replace(/\.[^.]+$/, "") || "profile-avatar";
  const extension = outputType === "image/png" ? "png" : "jpg";
  return new File([blob], `${baseName}-${AVATAR_EXPORT_SIZE}.${extension}`, { type: outputType });
}

export function AccountPersonalization() {
  const { user, refreshUser } = useAuth();
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
  const [avatarCropState, setAvatarCropState] = useState<AvatarCropState | null>(null);
  const [avatarCropZoom, setAvatarCropZoom] = useState(1);
  const [avatarCropOffset, setAvatarCropOffset] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

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
  const isAdminUser = ["owner", "admin", "team"].includes(String(user?.role ?? "").trim().toLowerCase());
  const sidebarOptions = useMemo(
    () => SIDEBAR_ITEM_OPTIONS.filter((option) => option.value !== "admin" || isAdminUser),
    [isAdminUser]
  );
  const selectedSidebarOptions = useMemo(
    () => sidebarOptions.filter((option) => preferences.sidebarItems.includes(option.value)),
    [preferences.sidebarItems, sidebarOptions]
  );
  const sidebarSummaryLabel = selectedSidebarOptions.length > 0 ? `${selectedSidebarOptions.length} items shown` : "No sidebar items selected";
  const rewardItems = useMemo(() => rewards?.badges ?? rewards?.achievements ?? [], [rewards]);
  const hasRewardsData = Boolean(
    rewards &&
      ((rewards.badges?.length ?? 0) > 0 ||
        rewards.achievements.length > 0 ||
        (rewards.badgeCount ?? 0) > 0 ||
        (rewards.totalCount ?? 0) > 0)
  );
  const hasImageUploadAccess = isAdminUser || String(user?.subscription_status ?? "").trim().toLowerCase() === "active";
  const highestTier = hasRewardsData
    ? highestUnlockedRewardTier(rewardItems.filter((badge) => badge.unlocked).map((badge) => badge.current_tier ?? badge.tier))
    : null;
  const unlockedThemeCount = themes.filter((themeOption) => !hasRewardsData || isTierUnlockableUnlocked(themeOption, rewardItems, isAdminUser)).length;
  const unlockedAvatarPresetCount = AVATAR_PRESETS.filter((preset) => !hasRewardsData || isTierUnlockableUnlocked(preset, rewardItems, isAdminUser)).length;
  const themeGroups = useMemo(
    () =>
      [
        { key: "starter", label: "Starter", tier: null as RewardTier | null, items: themes.filter((themeOption) => !themeOption.unlockTier) },
        ...REWARD_TIERS.map((tier) => ({
          key: tier,
          label: rewardTierLabel(tier),
          tier,
          items: themes.filter((themeOption) => themeOption.unlockTier === tier),
        })),
      ].filter((group) => group.items.length > 0),
    [themes]
  );
  const avatarPresetGroups = useMemo(
    () =>
      [
        { key: "starter", label: "Starter", tier: null as RewardTier | null, items: AVATAR_PRESETS.filter((preset) => !preset.unlockTier) },
        ...REWARD_TIERS.map((tier) => ({
          key: tier,
          label: rewardTierLabel(tier),
          tier,
          items: AVATAR_PRESETS.filter((preset) => preset.unlockTier === tier),
        })),
      ].filter((group) => group.items.length > 0),
    []
  );
  const currentThemeLabel = themes.find((themeOption) => themeOption.value === headerTheme)?.label ?? "Current";
  const currentGradientLabel =
    GRADIENT_MODE_OPTIONS.find((option) => option.value === preferences.gradientMode)?.label ?? "Full";
  const currentPanelStyleLabel =
    PANEL_STYLE_OPTIONS.find((option) => option.value === preferences.panelStyle)?.label ?? "Tinted";
  const currentAvatarLabel = useMemo(
    () => AVATAR_PRESETS.find((preset) => preset.value === avatarPreset)?.label ?? "Preset avatar",
    [avatarPreset]
  );
  const softPanelClass = getHeaderThemeSoftPanelClass(
    activeHeaderTheme,
    preferences.panelStyle,
    preferences.gradientMode
  );

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
    if (!hasImageUploadAccess) {
      toast("Subscribers and admins can upload a personal profile image.");
      return;
    }
    try {
      const cropData = await loadImageDimensions(file);
      setAvatarCropZoom(1);
      setAvatarCropOffset({ x: 0, y: 0 });
      setAvatarCropState({ file, ...cropData });
    } catch (e: any) {
      toast.error(e?.message || "Failed to load image preview");
    }
  };

  const closeAvatarCropDialog = () => {
    if (avatarCropState?.previewUrl) {
      URL.revokeObjectURL(avatarCropState.previewUrl);
    }
    dragStateRef.current = null;
    setAvatarCropState(null);
    setAvatarCropZoom(1);
    setAvatarCropOffset({ x: 0, y: 0 });
  };

  const handleConfirmAvatarUpload = async () => {
    if (!avatarCropState) return;
    setUploadingAvatar(true);
    try {
      const croppedFile = await buildCroppedAvatarFile(
        avatarCropState,
        avatarCropZoom,
        avatarCropOffset.x,
        avatarCropOffset.y
      );
      const updated = await api.uploadMyAvatar(croppedFile);
      setAvatarUrl(updated.avatar_url || null);
      setAvatarPreset(updated.avatar_preset || null);
      await refreshUser();
      toast.success("Profile photo updated");
      closeAvatarCropDialog();
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
      toast("Unlock more badges at this tier to use this colorway.");
      return;
    }
    setHeaderTheme(themeValue);
  };

  const setSidebarItemEnabled = (item: SidebarItemValue, enabled: boolean) => {
    const canonicalOrder = SIDEBAR_ITEM_OPTIONS.map((option) => option.value);
    const nextSidebarItems = enabled
      ? canonicalOrder.filter((value) => value === item || preferences.sidebarItems.includes(value))
      : preferences.sidebarItems.filter((value) => value !== item);
    updatePreferences({ sidebarItems: nextSidebarItems });
  };

  const cropPreviewDimensions = useMemo(() => {
    if (!avatarCropState) return null;
    return coveredImageDimensions(avatarCropState.imageWidth, avatarCropState.imageHeight, avatarCropZoom);
  }, [avatarCropState, avatarCropZoom]);

  useEffect(() => {
    if (!cropPreviewDimensions) return;
    setAvatarCropOffset((current) => ({
      x: clampAvatarOffset(current.x, cropPreviewDimensions.scaledWidth),
      y: clampAvatarOffset(current.y, cropPreviewDimensions.scaledHeight),
    }));
  }, [cropPreviewDimensions]);

  useEffect(() => () => {
    if (avatarCropState?.previewUrl) {
      URL.revokeObjectURL(avatarCropState.previewUrl);
    }
  }, [avatarCropState]);

  if (loading) {
    return (
      <div className="max-w-6xl space-y-5">
        <AccountSectionNav />
        <Card className="border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-gray-500 dark:text-slate-400">Loading personalization...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-5">
      <AccountSectionNav />

      <div className={`overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 ${activeHeaderTheme.heroClass}`}>
        <div className="px-5 py-5 md:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16 shadow-sm ring-4 ring-white/70 dark:ring-slate-950/50">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={`${username || "Account"} avatar`} /> : null}
                <AvatarFallback className={`text-xl font-bold ${avatarPresetClass(avatarPreset) ?? activeHeaderTheme.avatarClass} text-white`}>
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
                  Colors, avatar style, sidebar contents, and navigation defaults for {email || username || "your account"}.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Theme</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{themeSummary}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Start Page</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{startPageLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Sidebar</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{sidebarSummaryLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Avatar</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{avatarUrl ? "Uploaded photo" : avatarPreset || "Preset"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <CollapsibleSettingsCard
            title="Workspace Colors"
            description="Pick a theme visually from compact swatches grouped by unlock tier."
            summary={`${themeSummary} mode with the ${currentThemeLabel} header theme. ${unlockedThemeCount}/${themes.length} themes available.`}
            icon={
              <div className={`rounded-2xl p-2.5 ${softPanelClass}`}>
                <Palette className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              </div>
            }
            actions={
              <Button variant="outline" onClick={handleResetPersonalization}>
                Reset
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
            </div>

            <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
              {isAdminUser
                ? `Admin access unlocks all ${themes.length} workspace themes and all ${AVATAR_PRESETS.length} avatar colorways automatically.`
                : hasRewardsData
                  ? `${unlockedThemeCount}/${themes.length} header themes and ${unlockedAvatarPresetCount}/${AVATAR_PRESETS.length} avatar colorways are available. Highest unlocked tier: ${rewardTierLabel(highestTier)}.`
                  : "Achievement sync is unavailable right now, so all header themes remain selectable until badge progress reloads."}
            </div>

            <div className="mt-3 space-y-3.5">
              {themeGroups.map((group) => {
                const tierClass = rewardTierClasses(group.tier);
                const unlockedInGroup = group.items.filter((themeOption) => !hasRewardsData || isTierUnlockableUnlocked(themeOption, rewardItems, isAdminUser)).length;
                const currentTierUnlocks = group.tier ? unlockableCountForTier(rewardItems, group.tier, isAdminUser) : group.items.length;
                return (
                  <div
                    key={`theme-group:${group.key}`}
                    className="rounded-2xl border border-slate-200 bg-white/75 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/35"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${group.tier ? tierClass.chip : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>
                          {group.label}
                        </span>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {group.tier
                            ? `${Math.min(currentTierUnlocks, group.items.length)}/${group.items.length} colorways unlocked at this tier`
                            : `${group.items.length} starter colorways`}
                        </p>
                      </div>
                      <Badge variant="outline" className="h-6 px-2 text-[11px] dark:border-slate-700 dark:text-slate-200">
                        {unlockedInGroup}/{group.items.length} available
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {group.items.map((themeOption) => {
                        const isSelected = headerTheme === themeOption.value;
                        const isLocked = hasRewardsData && !isTierUnlockableUnlocked(themeOption, rewardItems, isAdminUser) && !isSelected;
                        return (
                          <button
                            key={themeOption.value}
                            type="button"
                            onClick={() => handleSelectTheme(themeOption.value, isLocked)}
                            disabled={isLocked}
                            className={`relative h-11 w-11 rounded-full border transition ${
                              isSelected
                                ? "border-slate-900 shadow-[0_0_0_3px_rgba(15,23,42,0.08)] dark:border-slate-100 dark:shadow-[0_0_0_3px_rgba(248,250,252,0.1)]"
                                : isLocked
                                  ? "border-slate-200 opacity-55 dark:border-slate-800"
                                  : "border-slate-200 hover:scale-[1.03] hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500"
                            }`}
                            aria-pressed={isSelected}
                            aria-label={`Use ${themeOption.label}`}
                            title={themeOption.label}
                          >
                            <span
                              className="block h-full w-full rounded-full"
                              style={{
                                background: `linear-gradient(135deg, ${themeOption.swatchColors.join(", ")})`,
                              }}
                            />
                            {isSelected ? (
                              <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80 dark:ring-slate-950/80" />
                            ) : null}
                            {isLocked ? (
                              <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-white bg-slate-900 text-white shadow-sm dark:border-slate-950 dark:bg-slate-100 dark:text-slate-950">
                                <Lock className="h-2.5 w-2.5" />
                              </span>
                            ) : null}
                            <span className="sr-only">{themeOption.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSettingsCard>

          <CollapsibleSettingsCard
            title="Workspace Behavior"
            description="Choose where you land first and how visually dense or expressive the workspace feels."
            summary={`${startPageLabel} start page, ${currentGradientLabel.toLowerCase()} gradients, and ${currentPanelStyleLabel.toLowerCase()} panels.`}
            icon={
              <div className={`rounded-2xl p-2.5 ${softPanelClass}`}>
                <MonitorCog className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              </div>
            }
          >
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
              <div>
                <Label htmlFor="gradient-mode">Gradient Intensity</Label>
                <Select
                  value={preferences.gradientMode}
                  onValueChange={(value) => updatePreferences({ gradientMode: value as typeof preferences.gradientMode })}
                >
                  <SelectTrigger id="gradient-mode" className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                    <SelectValue placeholder="Select gradient intensity" />
                  </SelectTrigger>
                  <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    {GRADIENT_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {GRADIENT_MODE_OPTIONS.find((option) => option.value === preferences.gradientMode)?.description}
                </p>
              </div>
              <div>
                <Label htmlFor="panel-style">Panel Style</Label>
                <Select
                  value={preferences.panelStyle}
                  onValueChange={(value) => updatePreferences({ panelStyle: value as typeof preferences.panelStyle })}
                >
                  <SelectTrigger id="panel-style" className="mt-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                    <SelectValue placeholder="Select panel style" />
                  </SelectTrigger>
                  <SelectContent className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    {PANEL_STYLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {PANEL_STYLE_OPTIONS.find((option) => option.value === preferences.panelStyle)?.description}
                </p>
              </div>
              <PreferenceRow
                title="Reduce motion"
                description="Tone down transitions and motion-heavy UI changes."
                checked={preferences.reducedMotion}
                onCheckedChange={(value) => updatePreferences({ reducedMotion: value })}
              />
              <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label>Sidebar Contents</Label>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Choose which links and shortcuts appear in the sidebar.
                    </p>
                  </div>
                  <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-200">
                    {selectedSidebarOptions.length}/{sidebarOptions.length} shown
                  </Badge>
                </div>
                <div className="mt-3 space-y-3">
                  {sidebarOptions.map((option) => {
                    const checked = preferences.sidebarItems.includes(option.value);
                    return (
                      <PreferenceRow
                        key={option.value}
                        title={option.label}
                        description={option.description}
                        checked={checked}
                        onCheckedChange={(value) => setSidebarItemEnabled(option.value, value)}
                      />
                    );
                  })}
                </div>
              </div>
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
              <PreferenceRow
                title="Show next achievement card"
                description="Keep the cross-page milestone progress card visible."
                checked={preferences.showNextAchievementCard}
                onCheckedChange={(value) => updatePreferences({ showNextAchievementCard: value })}
              />
            </div>
          </CollapsibleSettingsCard>
        </div>

        <div className="space-y-5">
          <CollapsibleSettingsCard
            title="Profile Icon"
            description="Upload a photo or choose a preset color. Uploaded photos can be resized and repositioned before saving."
            summary={`${avatarUrl ? "Uploaded photo active" : `${currentAvatarLabel} preset active`}. ${unlockedAvatarPresetCount}/${AVATAR_PRESETS.length} avatar colorways available.`}
            icon={
              <div className={`rounded-2xl p-2.5 ${softPanelClass}`}>
                <Upload className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              </div>
            }
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={`${username || "Account"} avatar preview`} /> : null}
                  <AvatarFallback className={`text-base font-bold ${avatarPresetClass(avatarPreset) ?? activeHeaderTheme.avatarClass} text-white`}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Profile photo</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {hasImageUploadAccess
                      ? "PNG, JPG, JPEG, and WEBP up to 5 MB."
                      : "Personal photo uploads are available for subscribers and admins."}
                  </p>
                </div>
              </div>

              <Input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                className="mt-3 bg-white dark:bg-slate-950/70"
                disabled={uploadingAvatar || !hasImageUploadAccess}
                onChange={(event) => {
                  handleAvatarUpload(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
              {hasImageUploadAccess ? (
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  After selecting an image, you can zoom and reposition it so it fits the circular profile icon better.
                </p>
              ) : null}
              {!hasImageUploadAccess ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                  <span>Use avatar colorways now, or activate a subscription to upload a personal image.</span>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/app/account">Open Billing</Link>
                  </Button>
                </div>
              ) : null}

              <div className="mt-3 space-y-3.5">
                {avatarPresetGroups.map((group) => {
                  const tierClass = rewardTierClasses(group.tier);
                  const unlockedInGroup = group.items.filter((preset) => !hasRewardsData || isTierUnlockableUnlocked(preset, rewardItems, isAdminUser)).length;
                  const currentTierUnlocks = group.tier ? unlockableCountForTier(rewardItems, group.tier, isAdminUser) : group.items.length;
                  return (
                    <div
                      key={`avatar-group:${group.key}`}
                      className="rounded-2xl border border-slate-200 bg-white/75 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/35"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${group.tier ? tierClass.chip : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>
                            {group.label}
                          </span>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {group.tier
                              ? `${Math.min(currentTierUnlocks, group.items.length)}/${group.items.length} avatar colorways unlocked`
                              : `${group.items.length} starter presets`}
                          </p>
                        </div>
                        <Badge variant="outline" className="h-6 px-2 text-[11px] dark:border-slate-700 dark:text-slate-200">
                          {unlockedInGroup}/{group.items.length} available
                        </Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2.5">
                        {group.items.map((preset) => {
                          const selected = !avatarUrl && avatarPreset === preset.value;
                          const isLocked = hasRewardsData && !isTierUnlockableUnlocked(preset, rewardItems, isAdminUser) && !selected;
                          return (
                            <button
                              type="button"
                              key={preset.value}
                              onClick={() => {
                                if (isLocked) {
                                  toast("Unlock more badges at this tier to use this colorway.");
                                  return;
                                }
                                handleSelectAvatarPreset(preset.value);
                              }}
                              disabled={isLocked}
                              className={`relative h-11 w-11 rounded-full border transition ${
                                selected
                                  ? "border-slate-900 shadow-[0_0_0_3px_rgba(15,23,42,0.08)] dark:border-slate-100 dark:shadow-[0_0_0_3px_rgba(248,250,252,0.1)]"
                                  : isLocked
                                    ? "border-slate-200 opacity-55 dark:border-slate-700"
                                    : "border-slate-200 hover:scale-[1.03] hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500"
                              }`}
                              aria-pressed={selected}
                              aria-label={`Use ${preset.label}`}
                              title={preset.label}
                            >
                              <div className={`flex h-full w-full items-center justify-center rounded-full text-sm font-bold ${preset.className}`}>
                                {initials}
                              </div>
                              {selected ? (
                                <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80 dark:ring-slate-950/80" />
                              ) : null}
                              {isLocked ? (
                                <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-white bg-slate-900 text-white shadow-sm dark:border-slate-950 dark:bg-slate-100 dark:text-slate-950">
                                  <Lock className="h-2.5 w-2.5" />
                                </span>
                              ) : null}
                              <span className="sr-only">{preset.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CollapsibleSettingsCard>

          <CollapsibleSettingsCard
            title="Current Setup"
            description="A quick summary of your active account personalization."
            summary={`${themeSummary} mode, ${currentGradientLabel.toLowerCase()} gradients, ${currentPanelStyleLabel.toLowerCase()} panels, and ${selectedSidebarOptions.length} sidebar items.`}
            icon={
              <div className={`rounded-2xl p-2.5 ${softPanelClass}`}>
                <Sparkles className={`h-5 w-5 ${activeHeaderTheme.accentTextClass}`} />
              </div>
            }
          >
            <div className="space-y-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Theme + Header</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {themeSummary} with the {themes.find((item) => item.value === headerTheme)?.label ?? "current"} header style
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Appearance</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {currentGradientLabel} gradients and {currentPanelStyleLabel.toLowerCase()} panels.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Navigation</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {startPageLabel} is your start page, with {selectedSidebarOptions.length} sidebar items shown.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Dashboard Focus</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {preferences.showRecentActivity ? "Recent activity visible" : "Recent activity hidden"},{" "}
                  {preferences.showPortfolioInsights ? "analytics cards visible" : "analytics cards hidden"}, and{" "}
                  {preferences.showNextAchievementCard ? "achievement card visible" : "achievement card hidden"}.
                </p>
              </div>
            </div>
          </CollapsibleSettingsCard>
        </div>
      </div>

      <Dialog open={Boolean(avatarCropState)} onOpenChange={(open) => (!open ? closeAvatarCropDialog() : undefined)}>
        <DialogContent className="border-slate-200 sm:max-w-xl dark:border-slate-800 dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle>Fit Profile Photo</DialogTitle>
            <DialogDescription>
              Resize and reposition your image so the important part stays inside the profile icon.
            </DialogDescription>
          </DialogHeader>

          {avatarCropState && cropPreviewDimensions ? (
            <div className="space-y-5">
              <div className="flex justify-center">
                <div
                  className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-slate-100 shadow-inner dark:border-slate-800 dark:bg-slate-900"
                  style={{ width: AVATAR_CROP_SIZE, height: AVATAR_CROP_SIZE }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    dragStateRef.current = {
                      pointerId: event.pointerId,
                      startX: event.clientX,
                      startY: event.clientY,
                      originX: avatarCropOffset.x,
                      originY: avatarCropOffset.y,
                    };
                  }}
                  onPointerMove={(event) => {
                    if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId || !cropPreviewDimensions) return;
                    const deltaX = event.clientX - dragStateRef.current.startX;
                    const deltaY = event.clientY - dragStateRef.current.startY;
                    setAvatarCropOffset({
                      x: clampAvatarOffset(dragStateRef.current.originX + deltaX, cropPreviewDimensions.scaledWidth),
                      y: clampAvatarOffset(dragStateRef.current.originY + deltaY, cropPreviewDimensions.scaledHeight),
                    });
                  }}
                  onPointerUp={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    dragStateRef.current = null;
                  }}
                  onPointerCancel={() => {
                    dragStateRef.current = null;
                  }}
                >
                  <img
                    src={avatarCropState.previewUrl}
                    alt="Profile crop preview"
                    className="pointer-events-none absolute max-w-none select-none"
                    draggable={false}
                    style={{
                      width: cropPreviewDimensions.scaledWidth,
                      height: cropPreviewDimensions.scaledHeight,
                      left: (AVATAR_CROP_SIZE - cropPreviewDimensions.scaledWidth) / 2 + avatarCropOffset.x,
                      top: (AVATAR_CROP_SIZE - cropPreviewDimensions.scaledHeight) / 2 + avatarCropOffset.y,
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/60 dark:ring-slate-200/10" />
                  <div className="pointer-events-none absolute inset-[24px] rounded-full border-2 border-white/90 shadow-[0_0_0_999px_rgba(15,23,42,0.42)] dark:border-slate-100/90" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Label>Zoom</Label>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{avatarCropZoom.toFixed(2)}x</span>
                  </div>
                  <Slider
                    min={1}
                    max={2.4}
                    step={0.01}
                    value={[avatarCropZoom]}
                    onValueChange={(value) => setAvatarCropZoom(value[0] ?? 1)}
                    className="mt-3"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                  <span>Drag the image to choose what stays visible inside the circular icon.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAvatarCropZoom(1);
                      setAvatarCropOffset({ x: 0, y: 0 });
                    }}
                  >
                    Reset Fit
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAvatarCropDialog} disabled={uploadingAvatar}>
              Cancel
            </Button>
            <Button type="button" className={activeHeaderTheme.buttonClass} onClick={handleConfirmAvatarUpload} disabled={uploadingAvatar}>
              {uploadingAvatar ? "Saving..." : "Use This Fit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
