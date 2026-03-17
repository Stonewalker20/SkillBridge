import { useEffect, useMemo, useState } from "react";

export const ACCOUNT_HEADER_THEME_STORAGE_KEY = "account:headerTheme";
export const ACCOUNT_HEADER_THEME_EVENT = "skillbridge:header-theme-change";

export const ACCOUNT_HEADER_THEMES = [
  {
    value: "ocean",
    label: "Ocean Blue",
    swatchColors: ["#1E3A8A", "#0F766E", "#DBEAFE"],
    heroClass:
      "bg-[radial-gradient(circle_at_top_left,_rgba(30,58,138,0.26),_transparent_40%),linear-gradient(135deg,_#eef4ff,_#f8fbff_55%,_#eef6ff)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.10),_transparent_34%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.98))]",
    avatarClass: "bg-[linear-gradient(135deg,_#1E3A8A,_#0F766E)]",
    buttonClass: "bg-[#1E3A8A] text-white hover:bg-[#1d4ed8]",
    barClass: "bg-[linear-gradient(90deg,_#1E3A8A,_#0F766E)]",
    accentTextClass: "text-[#1E3A8A] dark:text-blue-300",
    softPanelClass: "bg-[linear-gradient(135deg,_rgba(30,58,138,0.08),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(45,212,191,0.10),_rgba(15,23,42,0.95))]",
    sidebarClass:
      "bg-[linear-gradient(180deg,_rgba(236,244,255,0.98),_rgba(219,234,254,0.92)_52%,_rgba(241,245,249,0.96))] dark:bg-[linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.96))]",
    sidebarActiveClass: "bg-[linear-gradient(135deg,_#1E3A8A,_#0F766E)] text-white shadow-sm",
  },
  {
    value: "sunrise",
    label: "Sunrise Gold",
    swatchColors: ["#F59E0B", "#D97706", "#FDE68A"],
    heroClass:
      "bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.30),_transparent_42%),linear-gradient(135deg,_#fff8e7,_#fde68a_58%,_#fff7ed)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.20),_transparent_34%),linear-gradient(135deg,_#2a1e06,_#120d03)]",
    avatarClass: "bg-[linear-gradient(135deg,_#F59E0B,_#D97706)]",
    buttonClass: "bg-[#D97706] text-white hover:bg-[#b45309]",
    barClass: "bg-[linear-gradient(90deg,_#F59E0B,_#D97706)]",
    accentTextClass: "text-[#D97706] dark:text-amber-300",
    softPanelClass: "bg-[linear-gradient(135deg,_rgba(251,191,36,0.16),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(251,191,36,0.14),_rgba(18,13,3,0.94))]",
    sidebarClass:
      "bg-[linear-gradient(180deg,_rgba(255,248,231,0.98),_rgba(254,240,138,0.88)_52%,_rgba(255,247,237,0.96))] dark:bg-[linear-gradient(180deg,_rgba(39,24,4,0.98),_rgba(18,13,3,0.96))]",
    sidebarActiveClass: "bg-[linear-gradient(135deg,_#F59E0B,_#D97706)] text-white shadow-sm",
  },
  {
    value: "forest",
    label: "Forest Teal",
    swatchColors: ["#0F766E", "#14B8A6", "#CCFBF1"],
    heroClass:
      "bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.24),_transparent_40%),linear-gradient(135deg,_#ecfdf5,_#ccfbf1_56%,_#f0fdfa)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_34%),linear-gradient(135deg,_#07231f,_#041310)]",
    avatarClass: "bg-[linear-gradient(135deg,_#0F766E,_#115E59)]",
    buttonClass: "bg-[#0F766E] text-white hover:bg-[#115e59]",
    barClass: "bg-[linear-gradient(90deg,_#0F766E,_#14B8A6)]",
    accentTextClass: "text-[#0F766E] dark:text-teal-300",
    softPanelClass: "bg-[linear-gradient(135deg,_rgba(20,184,166,0.12),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(20,184,166,0.12),_rgba(4,19,16,0.94))]",
    sidebarClass:
      "bg-[linear-gradient(180deg,_rgba(236,253,245,0.98),_rgba(204,251,241,0.88)_52%,_rgba(240,253,250,0.96))] dark:bg-[linear-gradient(180deg,_rgba(7,35,31,0.98),_rgba(4,19,16,0.96))]",
    sidebarActiveClass: "bg-[linear-gradient(135deg,_#0F766E,_#115E59)] text-white shadow-sm",
  },
  {
    value: "plum",
    label: "Plum Slate",
    swatchColors: ["#7C3AED", "#4338CA", "#EDE9FE"],
    heroClass:
      "bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.24),_transparent_40%),linear-gradient(135deg,_#faf5ff,_#ede9fe_56%,_#f8fafc)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.14),_transparent_34%),linear-gradient(135deg,_#1b1028,_#0f172a)]",
    avatarClass: "bg-[linear-gradient(135deg,_#7C3AED,_#4338CA)]",
    buttonClass: "bg-[#7C3AED] text-white hover:bg-[#6d28d9]",
    barClass: "bg-[linear-gradient(90deg,_#7C3AED,_#4338CA)]",
    accentTextClass: "text-[#7C3AED] dark:text-violet-300",
    softPanelClass: "bg-[linear-gradient(135deg,_rgba(124,58,237,0.12),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(168,85,247,0.12),_rgba(15,23,42,0.94))]",
    sidebarClass:
      "bg-[linear-gradient(180deg,_rgba(250,245,255,0.98),_rgba(237,233,254,0.9)_52%,_rgba(248,250,252,0.96))] dark:bg-[linear-gradient(180deg,_rgba(27,16,40,0.98),_rgba(15,23,42,0.96))]",
    sidebarActiveClass: "bg-[linear-gradient(135deg,_#7C3AED,_#4338CA)] text-white shadow-sm",
  },
  {
    value: "rose",
    label: "Rose Ember",
    swatchColors: ["#E11D48", "#F97316", "#FFE4E6"],
    heroClass:
      "bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.20),_transparent_40%),linear-gradient(135deg,_#fff1f2,_#ffe4e6_56%,_#fff7ed)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,113,133,0.16),_transparent_34%),linear-gradient(135deg,_#2c0f16,_#17060b)]",
    avatarClass: "bg-[linear-gradient(135deg,_#E11D48,_#BE123C)]",
    buttonClass: "bg-[#E11D48] text-white hover:bg-[#be123c]",
    barClass: "bg-[linear-gradient(90deg,_#E11D48,_#F97316)]",
    accentTextClass: "text-[#E11D48] dark:text-rose-300",
    softPanelClass: "bg-[linear-gradient(135deg,_rgba(244,63,94,0.12),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(251,113,133,0.12),_rgba(23,6,11,0.94))]",
    sidebarClass:
      "bg-[linear-gradient(180deg,_rgba(255,241,242,0.98),_rgba(255,228,230,0.90)_52%,_rgba(255,247,237,0.96))] dark:bg-[linear-gradient(180deg,_rgba(44,15,22,0.98),_rgba(23,6,11,0.96))]",
    sidebarActiveClass: "bg-[linear-gradient(135deg,_#E11D48,_#F97316)] text-white shadow-sm",
  },
  {
    value: "slate",
    label: "Slate Steel",
    swatchColors: ["#334155", "#64748B", "#E2E8F0"],
    heroClass:
      "bg-[radial-gradient(circle_at_top_left,_rgba(71,85,105,0.20),_transparent_40%),linear-gradient(135deg,_#f8fafc,_#e2e8f0_58%,_#f1f5f9)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.14),_transparent_34%),linear-gradient(135deg,_#111827,_#020617)]",
    avatarClass: "bg-[linear-gradient(135deg,_#334155,_#0F172A)]",
    buttonClass: "bg-[#334155] text-white hover:bg-[#1e293b]",
    barClass: "bg-[linear-gradient(90deg,_#334155,_#64748B)]",
    accentTextClass: "text-[#334155] dark:text-slate-300",
    softPanelClass: "bg-[linear-gradient(135deg,_rgba(71,85,105,0.12),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(148,163,184,0.10),_rgba(2,6,23,0.94))]",
    sidebarClass:
      "bg-[linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(226,232,240,0.90)_52%,_rgba(241,245,249,0.96))] dark:bg-[linear-gradient(180deg,_rgba(17,24,39,0.98),_rgba(2,6,23,0.96))]",
    sidebarActiveClass: "bg-[linear-gradient(135deg,_#334155,_#64748B)] text-white shadow-sm",
  },
  {
    value: "cobalt",
    label: "Cobalt Mint",
    swatchColors: ["#2563EB", "#14B8A6", "#DBEAFE"],
    heroClass:
      "bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.22),_transparent_40%),linear-gradient(135deg,_#eff6ff,_#dbeafe_56%,_#ecfeff)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.16),_transparent_34%),linear-gradient(135deg,_#0a1630,_#03141a)]",
    avatarClass: "bg-[linear-gradient(135deg,_#2563EB,_#0F766E)]",
    buttonClass: "bg-[#2563EB] text-white hover:bg-[#1d4ed8]",
    barClass: "bg-[linear-gradient(90deg,_#2563EB,_#14B8A6)]",
    accentTextClass: "text-[#2563EB] dark:text-cyan-300",
    softPanelClass: "bg-[linear-gradient(135deg,_rgba(37,99,235,0.12),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(20,184,166,0.12),_rgba(3,20,26,0.94))]",
    sidebarClass:
      "bg-[linear-gradient(180deg,_rgba(239,246,255,0.98),_rgba(219,234,254,0.90)_52%,_rgba(236,254,255,0.96))] dark:bg-[linear-gradient(180deg,_rgba(10,22,48,0.98),_rgba(3,20,26,0.96))]",
    sidebarActiveClass: "bg-[linear-gradient(135deg,_#2563EB,_#14B8A6)] text-white shadow-sm",
  },
  {
    value: "aurora",
    label: "Aurora Sky",
    swatchColors: ["#0EA5E9", "#22C55E", "#DCFCE7"],
    heroClass:
      "bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_38%),linear-gradient(135deg,_#ecfeff,_#dcfce7_56%,_#eff6ff)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.15),_transparent_34%),linear-gradient(135deg,_#04161f,_#05150d)]",
    avatarClass: "bg-[linear-gradient(135deg,_#0EA5E9,_#22C55E)]",
    buttonClass: "bg-[#0EA5E9] text-white hover:bg-[#0284c7]",
    barClass: "bg-[linear-gradient(90deg,_#0EA5E9,_#22C55E)]",
    accentTextClass: "text-sky-600 dark:text-emerald-300",
    softPanelClass: "bg-[linear-gradient(135deg,_rgba(14,165,233,0.10),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(34,197,94,0.10),_rgba(5,21,13,0.94))]",
    sidebarClass:
      "bg-[linear-gradient(180deg,_rgba(236,254,255,0.98),_rgba(220,252,231,0.90)_52%,_rgba(239,246,255,0.96))] dark:bg-[linear-gradient(180deg,_rgba(4,22,31,0.98),_rgba(5,21,13,0.96))]",
    sidebarActiveClass: "bg-[linear-gradient(135deg,_#0EA5E9,_#22C55E)] text-white shadow-sm",
  },
  {
    value: "sandstone",
    label: "Sandstone Clay",
    swatchColors: ["#B45309", "#EA580C", "#FED7AA"],
    heroClass:
      "bg-[radial-gradient(circle_at_top_left,_rgba(234,88,12,0.20),_transparent_40%),linear-gradient(135deg,_#fff7ed,_#fed7aa_56%,_#ffedd5)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.14),_transparent_34%),linear-gradient(135deg,_#271205,_#180a04)]",
    avatarClass: "bg-[linear-gradient(135deg,_#B45309,_#EA580C)]",
    buttonClass: "bg-[#C2410C] text-white hover:bg-[#9a3412]",
    barClass: "bg-[linear-gradient(90deg,_#B45309,_#EA580C)]",
    accentTextClass: "text-orange-700 dark:text-orange-300",
    softPanelClass: "bg-[linear-gradient(135deg,_rgba(234,88,12,0.12),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(251,146,60,0.10),_rgba(24,10,4,0.94))]",
    sidebarClass:
      "bg-[linear-gradient(180deg,_rgba(255,247,237,0.98),_rgba(254,215,170,0.90)_52%,_rgba(255,237,213,0.96))] dark:bg-[linear-gradient(180deg,_rgba(39,18,5,0.98),_rgba(24,10,4,0.96))]",
    sidebarActiveClass: "bg-[linear-gradient(135deg,_#B45309,_#EA580C)] text-white shadow-sm",
  },
  {
    value: "orchid",
    label: "Orchid Pulse",
    swatchColors: ["#9333EA", "#EC4899", "#F5D0FE"],
    heroClass:
      "bg-[radial-gradient(circle_at_top_left,_rgba(147,51,234,0.22),_transparent_40%),linear-gradient(135deg,_#fdf4ff,_#f5d0fe_56%,_#fce7f3)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.14),_transparent_34%),linear-gradient(135deg,_#250925,_#180611)]",
    avatarClass: "bg-[linear-gradient(135deg,_#9333EA,_#EC4899)]",
    buttonClass: "bg-[#9333EA] text-white hover:bg-[#7e22ce]",
    barClass: "bg-[linear-gradient(90deg,_#9333EA,_#EC4899)]",
    accentTextClass: "text-fuchsia-600 dark:text-pink-300",
    softPanelClass: "bg-[linear-gradient(135deg,_rgba(147,51,234,0.12),_rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,_rgba(236,72,153,0.10),_rgba(24,6,17,0.94))]",
    sidebarClass:
      "bg-[linear-gradient(180deg,_rgba(253,244,255,0.98),_rgba(245,208,254,0.90)_52%,_rgba(252,231,243,0.96))] dark:bg-[linear-gradient(180deg,_rgba(37,9,37,0.98),_rgba(24,6,17,0.96))]",
    sidebarActiveClass: "bg-[linear-gradient(135deg,_#9333EA,_#EC4899)] text-white shadow-sm",
  },
] as const;

export type AccountHeaderThemeValue = (typeof ACCOUNT_HEADER_THEMES)[number]["value"];

export function readStoredHeaderTheme(): AccountHeaderThemeValue {
  if (typeof window === "undefined") return "ocean";
  const stored = window.localStorage.getItem(ACCOUNT_HEADER_THEME_STORAGE_KEY);
  return ACCOUNT_HEADER_THEMES.some((theme) => theme.value === stored) ? (stored as AccountHeaderThemeValue) : "ocean";
}

export function writeStoredHeaderTheme(value: AccountHeaderThemeValue) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCOUNT_HEADER_THEME_STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent(ACCOUNT_HEADER_THEME_EVENT, { detail: value }));
}

export function useHeaderTheme() {
  const [headerTheme, setHeaderThemeState] = useState<AccountHeaderThemeValue>(() => readStoredHeaderTheme());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleThemeChange = (event: Event) => {
      const nextValue =
        event instanceof CustomEvent && typeof event.detail === "string"
          ? (event.detail as AccountHeaderThemeValue)
          : readStoredHeaderTheme();
      setHeaderThemeState(nextValue);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ACCOUNT_HEADER_THEME_STORAGE_KEY) {
        setHeaderThemeState(readStoredHeaderTheme());
      }
    };
    window.addEventListener(ACCOUNT_HEADER_THEME_EVENT, handleThemeChange as EventListener);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(ACCOUNT_HEADER_THEME_EVENT, handleThemeChange as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const activeHeaderTheme = useMemo(
    () => ACCOUNT_HEADER_THEMES.find((theme) => theme.value === headerTheme) ?? ACCOUNT_HEADER_THEMES[0],
    [headerTheme]
  );

  const setHeaderTheme = (value: AccountHeaderThemeValue) => {
    setHeaderThemeState(value);
    writeStoredHeaderTheme(value);
  };

  return { headerTheme, setHeaderTheme, activeHeaderTheme, themes: ACCOUNT_HEADER_THEMES };
}
