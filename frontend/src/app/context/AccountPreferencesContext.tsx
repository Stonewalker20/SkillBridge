import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

export type StartPageValue =
  | "/app"
  | "/app/skills"
  | "/app/evidence"
  | "/app/jobs"
  | "/app/resumes"
  | "/app/analytics/skills";

export type SidebarDensityValue = "comfortable" | "compact";

export type AccountPreferences = {
  startPage: StartPageValue;
  sidebarDensity: SidebarDensityValue;
  showQuickActions: boolean;
  showWelcomeHero: boolean;
  showRecentActivity: boolean;
  showPortfolioInsights: boolean;
  reducedMotion: boolean;
};

type AccountPreferencesContextType = {
  preferences: AccountPreferences;
  updatePreferences: (updates: Partial<AccountPreferences>) => void;
  resetPreferences: () => void;
};

const DEFAULT_PREFERENCES: AccountPreferences = {
  startPage: "/app",
  sidebarDensity: "comfortable",
  showQuickActions: true,
  showWelcomeHero: true,
  showRecentActivity: true,
  showPortfolioInsights: true,
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

export const SIDEBAR_DENSITY_OPTIONS: Array<{ value: SidebarDensityValue; label: string; description: string }> = [
  { value: "comfortable", label: "Comfortable", description: "Roomier navigation with larger controls." },
  { value: "compact", label: "Compact", description: "Tighter spacing to keep more visible at once." },
];

const AccountPreferencesContext = createContext<AccountPreferencesContextType | undefined>(undefined);

function storageKey(userId: string) {
  return `sb_account_preferences:${userId}`;
}

function normalizeStartPage(value: unknown): StartPageValue {
  return START_PAGE_OPTIONS.some((option) => option.value === value) ? (value as StartPageValue) : DEFAULT_PREFERENCES.startPage;
}

function normalizeSidebarDensity(value: unknown): SidebarDensityValue {
  return SIDEBAR_DENSITY_OPTIONS.some((option) => option.value === value)
    ? (value as SidebarDensityValue)
    : DEFAULT_PREFERENCES.sidebarDensity;
}

function normalizePreferences(raw: unknown): AccountPreferences {
  const parsed = raw && typeof raw === "object" ? (raw as Partial<AccountPreferences>) : {};
  return {
    startPage: normalizeStartPage(parsed.startPage),
    sidebarDensity: normalizeSidebarDensity(parsed.sidebarDensity),
    showQuickActions: parsed.showQuickActions ?? DEFAULT_PREFERENCES.showQuickActions,
    showWelcomeHero: parsed.showWelcomeHero ?? DEFAULT_PREFERENCES.showWelcomeHero,
    showRecentActivity: parsed.showRecentActivity ?? DEFAULT_PREFERENCES.showRecentActivity,
    showPortfolioInsights: parsed.showPortfolioInsights ?? DEFAULT_PREFERENCES.showPortfolioInsights,
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
    document.documentElement.dataset.uiDensity = preferences.sidebarDensity;
    return () => {
      delete document.documentElement.dataset.uiMotion;
      delete document.documentElement.dataset.uiDensity;
    };
  }, [preferences.reducedMotion, preferences.sidebarDensity]);

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
