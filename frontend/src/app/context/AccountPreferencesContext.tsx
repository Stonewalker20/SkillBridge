import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

export type StartPageValue =
  | "/app"
  | "/app/skills"
  | "/app/evidence"
  | "/app/jobs"
  | "/app/resumes"
  | "/app/analytics/skills";

export type SidebarItemValue = "dashboard" | "skills" | "analytics" | "evidence" | "jobs" | "quickActions" | "admin";
export type GradientModeValue = "full" | "soft" | "flat";
export type PanelStyleValue = "tinted" | "glass" | "solid";

export type AccountPreferences = {
  startPage: StartPageValue;
  sidebarItems: SidebarItemValue[];
  gradientMode: GradientModeValue;
  panelStyle: PanelStyleValue;
  showWelcomeHero: boolean;
  showRecentActivity: boolean;
  showPortfolioInsights: boolean;
  showNextAchievementCard: boolean;
  reducedMotion: boolean;
};

type AccountPreferencesContextType = {
  preferences: AccountPreferences;
  updatePreferences: (updates: Partial<AccountPreferences>) => void;
  resetPreferences: () => void;
};

const DEFAULT_PREFERENCES: AccountPreferences = {
  startPage: "/app",
  sidebarItems: ["dashboard", "skills", "analytics", "evidence", "jobs", "quickActions", "admin"],
  gradientMode: "full",
  panelStyle: "tinted",
  showWelcomeHero: true,
  showRecentActivity: true,
  showPortfolioInsights: true,
  showNextAchievementCard: true,
  reducedMotion: false,
};

export const START_PAGE_OPTIONS: Array<{ value: StartPageValue; label: string; description: string }> = [
  { value: "/app", label: "Dashboard", description: "Open the full workspace overview first." },
  { value: "/app/jobs", label: "Job Match", description: "Jump directly into job analysis work." },
  { value: "/app/skills", label: "Skills", description: "Start in your confirmed skill library." },
  { value: "/app/evidence", label: "Evidence", description: "Open your proof and project artifacts first." },
  { value: "/app/resumes", label: "Tailored Resumes", description: "Land in your saved tailored resume history." },
  { value: "/app/analytics/skills", label: "Analytics", description: "Start with skills and portfolio analytics." },
];

export const SIDEBAR_ITEM_OPTIONS: Array<{ value: SidebarItemValue; label: string; description: string }> = [
  { value: "dashboard", label: "Dashboard", description: "Show the workspace overview link." },
  { value: "skills", label: "Skills", description: "Show the skills library link." },
  { value: "analytics", label: "Analytics", description: "Show the skills analytics link." },
  { value: "evidence", label: "Evidence", description: "Show the evidence library link." },
  { value: "jobs", label: "Job Match", description: "Show the job analysis link." },
  { value: "quickActions", label: "Quick Actions", description: "Show sidebar shortcuts for common tasks." },
  { value: "admin", label: "Admin", description: "Show the admin link when your account can access it." },
];

export const GRADIENT_MODE_OPTIONS: Array<{ value: GradientModeValue; label: string; description: string }> = [
  { value: "full", label: "Full", description: "Keep the full themed gradients and animated color flow." },
  { value: "soft", label: "Soft", description: "Use lighter, calmer gradients with less visual intensity." },
  { value: "flat", label: "Flat", description: "Use mostly solid surfaces with minimal gradient treatment." },
];

export const PANEL_STYLE_OPTIONS: Array<{ value: PanelStyleValue; label: string; description: string }> = [
  { value: "tinted", label: "Tinted", description: "Keep panels color-matched to your active theme." },
  { value: "glass", label: "Glass", description: "Use translucent blurred panels for a softer workspace." },
  { value: "solid", label: "Solid", description: "Use cleaner, solid cards with less visual texture." },
];

const AccountPreferencesContext = createContext<AccountPreferencesContextType | undefined>(undefined);

function storageKey(userId: string) {
  return `sb_account_preferences:${userId}`;
}

function normalizeStartPage(value: unknown): StartPageValue {
  return START_PAGE_OPTIONS.some((option) => option.value === value) ? (value as StartPageValue) : DEFAULT_PREFERENCES.startPage;
}

function normalizeSidebarItems(value: unknown): SidebarItemValue[] {
  const rawValues = Array.isArray(value) ? value : [];
  return SIDEBAR_ITEM_OPTIONS.map((option) => option.value).filter((item) => rawValues.includes(item));
}

function normalizeGradientMode(value: unknown): GradientModeValue {
  return GRADIENT_MODE_OPTIONS.some((option) => option.value === value)
    ? (value as GradientModeValue)
    : DEFAULT_PREFERENCES.gradientMode;
}

function normalizePanelStyle(value: unknown): PanelStyleValue {
  return PANEL_STYLE_OPTIONS.some((option) => option.value === value)
    ? (value as PanelStyleValue)
    : DEFAULT_PREFERENCES.panelStyle;
}

function normalizePreferences(raw: unknown): AccountPreferences {
  const parsed = raw && typeof raw === "object" ? (raw as Partial<AccountPreferences>) : {};
  const hasSidebarItems = Array.isArray((parsed as { sidebarItems?: unknown }).sidebarItems);
  const legacyQuickActions = (parsed as { showQuickActions?: unknown }).showQuickActions;
  return {
    startPage: normalizeStartPage(parsed.startPage),
    sidebarItems: hasSidebarItems
      ? normalizeSidebarItems((parsed as { sidebarItems?: unknown }).sidebarItems)
      : legacyQuickActions === false
        ? DEFAULT_PREFERENCES.sidebarItems.filter((item) => item !== "quickActions")
        : DEFAULT_PREFERENCES.sidebarItems,
    gradientMode: normalizeGradientMode(parsed.gradientMode),
    panelStyle: normalizePanelStyle(parsed.panelStyle),
    showWelcomeHero: parsed.showWelcomeHero ?? DEFAULT_PREFERENCES.showWelcomeHero,
    showRecentActivity: parsed.showRecentActivity ?? DEFAULT_PREFERENCES.showRecentActivity,
    showPortfolioInsights: parsed.showPortfolioInsights ?? DEFAULT_PREFERENCES.showPortfolioInsights,
    showNextAchievementCard: parsed.showNextAchievementCard ?? DEFAULT_PREFERENCES.showNextAchievementCard,
    reducedMotion: parsed.reducedMotion ?? DEFAULT_PREFERENCES.reducedMotion,
  };
}

export function AccountPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<AccountPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (!user?.id) {
      setPreferences(DEFAULT_PREFERENCES);
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey(user.id));
      const parsed = raw ? JSON.parse(raw) : DEFAULT_PREFERENCES;
      setPreferences(normalizePreferences(parsed));
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    window.localStorage.setItem(storageKey(user.id), JSON.stringify(preferences));
  }, [preferences, user?.id]);

  useEffect(() => {
    document.documentElement.dataset.uiMotion = preferences.reducedMotion ? "reduced" : "full";
    document.documentElement.dataset.uiGradient = preferences.gradientMode;
    document.documentElement.dataset.uiPanel = preferences.panelStyle;
    return () => {
      delete document.documentElement.dataset.uiMotion;
      delete document.documentElement.dataset.uiGradient;
      delete document.documentElement.dataset.uiPanel;
    };
  }, [preferences.gradientMode, preferences.panelStyle, preferences.reducedMotion]);

  const value = useMemo<AccountPreferencesContextType>(
    () => ({
      preferences,
      updatePreferences: (updates) => {
        setPreferences((current) => normalizePreferences({ ...current, ...updates }));
      },
      resetPreferences: () => {
        setPreferences(DEFAULT_PREFERENCES);
      },
    }),
    [preferences]
  );

  return <AccountPreferencesContext.Provider value={value}>{children}</AccountPreferencesContext.Provider>;
}

export function useAccountPreferences() {
  const context = useContext(AccountPreferencesContext);
  if (!context) {
    throw new Error("useAccountPreferences must be used within an AccountPreferencesProvider");
  }
  return context;
}
