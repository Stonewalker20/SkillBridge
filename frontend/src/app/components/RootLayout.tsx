import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { 
  LayoutDashboard, 
  Briefcase, 
  FolderOpen, 
  FileText,
  Target,
  BarChart3,
  Shield,
  Menu,
  X,
  LogOut,
  Moon,
  Sun,
  LifeBuoy
} from "lucide-react";
import { cn } from "./ui/utils";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Switch } from "./ui/switch";
import LogoImage from "../../imports/skillbridge_logo.png";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { getHeaderThemePageClass, getHeaderThemeSidebarClass, getHeaderThemeSoftPanelClass, useHeaderTheme } from "../lib/headerTheme";
import { avatarPresetClass } from "../lib/avatarPresets";
import { useAccountPreferences, type SidebarItemValue } from "../context/AccountPreferencesContext";
import { SubscriptionGate } from "./SubscriptionGate";
import { GetStartedAgent } from "./GetStartedAgent";

type SidebarNavigationKey = Exclude<SidebarItemValue, "quickActions" | "admin">;

const baseNavigation = [
  { key: "dashboard", name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { key: "skills", name: "Skills", href: "/app/skills", icon: Target },
  { key: "analytics", name: "Analytics", href: "/app/analytics/skills", icon: BarChart3 },
  { key: "evidence", name: "Evidence", href: "/app/evidence", icon: FolderOpen },
  { key: "jobs", name: "Job Match", href: "/app/jobs", icon: Briefcase },
] as const satisfies ReadonlyArray<{
  key: SidebarNavigationKey;
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
}>;

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeHeaderTheme } = useHeaderTheme();
  const { preferences } = useAccountPreferences();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayName = user?.username || user?.email?.split("@")[0] || "Account";
  const isAdminUser = ["owner", "admin", "team"].includes(String(user?.role ?? "").toLowerCase());
  const hasPlatformAccess = isAdminUser || String(user?.subscription_status ?? "").toLowerCase() === "active";
  const isAccountPage = location.pathname === "/app/account" || location.pathname.startsWith("/app/account/");
  const isSubscriptionLocked = !hasPlatformAccess;
  const navigation = [
    ...baseNavigation.filter((item) => preferences.sidebarItems.includes(item.key)),
    ...(hasPlatformAccess && preferences.sidebarItems.includes("admin")
      ? [{ key: "admin", name: "Admin", href: "/app/admin", icon: Shield }]
      : []),
  ];
  const initials = (() => {
    const parts = String(displayName).trim().split(/[\s._-]+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "S";
    const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "B";
    return (a + b).toUpperCase();
  })();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navigateFromSidebar = (href: string) => {
    setMobileMenuOpen(false);
    const [pathname, rawSearch = ""] = href.split("?");
    const next = new URLSearchParams(rawSearch);
    next.set("_nav", String(Date.now()));
    navigate(`${pathname}?${next.toString()}`);
  };

  const isDark = mounted && resolvedTheme === "dark";
  const isCompactSidebar = true;
  const quickActionsVisible = preferences.sidebarItems.includes("quickActions");
  const unreadHelpCount = Math.max(0, Number(user?.help_unread_response_count ?? 0) || 0);
  const pageClass = getHeaderThemePageClass(activeHeaderTheme, preferences.gradientMode);
  const sidebarClass = getHeaderThemeSidebarClass(activeHeaderTheme, preferences.panelStyle, preferences.gradientMode);
  const softPanelClass = getHeaderThemeSoftPanelClass(activeHeaderTheme, preferences.panelStyle, preferences.gradientMode);

  let currentPageTitle = "Page";
  if (isSubscriptionLocked && !isAccountPage) {
    currentPageTitle = "Subscription required";
  } else if (location.pathname === "/app/account") {
    currentPageTitle = "Account";
  } else if (location.pathname.startsWith("/app/account/personalization")) {
    currentPageTitle = "Personalization";
  } else if (location.pathname.startsWith("/app/account/ai")) {
    currentPageTitle = "AI Settings";
  } else if (location.pathname.startsWith("/app/account/achievements")) {
    currentPageTitle = "Achievements";
  } else if (location.pathname.startsWith("/app/account/help")) {
    currentPageTitle = "Help";
  } else if (location.pathname.startsWith("/app/admin/mlflow")) {
    currentPageTitle = "Admin MLflow";
  } else if (location.pathname === "/app/admin") {
    currentPageTitle = "Admin";
  } else if (location.pathname === "/app/analytics/skills") {
    currentPageTitle = "Skill Analytics";
  } else if (location.pathname.startsWith("/app/analytics/career-paths/")) {
    currentPageTitle = "Career Path";
  } else {
    currentPageTitle = navigation.find((item) => item.href === location.pathname)?.name || "Page";
  }

  return (
    <div className={cn("flex min-h-svh text-slate-900 dark:text-slate-100 lg:h-svh lg:overflow-hidden", pageClass)}>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-svh flex-col overflow-hidden border-r border-slate-200/70 text-[clamp(0.82rem,0.76rem+0.18vh,0.96rem)] backdrop-blur-xl ease-in-out dark:border-slate-800/80 lg:sticky lg:top-0 lg:h-svh lg:translate-x-0",
        preferences.reducedMotion ? "transition-none" : "transition-transform duration-300",
        sidebarClass,
        isCompactSidebar ? "w-56" : "w-64",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Close button for mobile */}
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="absolute right-3 top-3 z-20 rounded-full border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className={cn(
          "shrink-0 border-b border-slate-200/80 bg-white/55 dark:border-slate-800/80 dark:bg-slate-950/35",
          isCompactSidebar
            ? "px-2.5 py-2.5"
            : "px-[clamp(0.85rem,0.65rem+0.8vh,1.25rem)] py-[clamp(0.6rem,0.35rem+1vh,1.15rem)]"
        )}>
          <Link
            to="/app"
            className="flex items-center justify-center overflow-hidden rounded-2xl bg-white/90 px-0.5 py-[clamp(0.15rem,0.08rem+0.28vh,0.35rem)] shadow-sm ring-1 ring-slate-200/80 transition-opacity hover:opacity-90 dark:bg-slate-950/80 dark:ring-slate-800/80"
          >
            <img
              src={LogoImage}
              alt="SkillBridge Logo"
              className={cn(
                "w-full object-contain object-center",
                isCompactSidebar
                  ? "h-[5.2rem] max-w-[190px] scale-[1.62]"
                  : "h-[clamp(5.5rem,4.2rem+6.8vh,8rem)] max-w-[226px] scale-[1.78]"
              )}
            />
          </Link>
        </div>
        
        <nav className={cn(
          "flex flex-1 flex-col",
          isCompactSidebar
            ? "gap-1.5 px-2.5 py-2.5"
            : "gap-[clamp(0.4rem,0.2rem+0.5vh,0.9rem)] px-[clamp(0.75rem,0.5rem+0.7vh,1rem)] py-[clamp(0.6rem,0.35rem+0.75vh,1rem)]"
        )}>
          {navigation.map((item) => {
            const isActive =
              item.href === "/app"
                ? location.pathname === "/app"
                : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={(event) => {
                  event.preventDefault();
                  navigateFromSidebar(item.href);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl transition-all",
                  isCompactSidebar ? "px-3 py-2.5" : "px-[clamp(0.8rem,0.55rem+0.65vh,1rem)] py-[clamp(0.55rem,0.35rem+0.65vh,0.8rem)]",
                  isActive
                    ? activeHeaderTheme.sidebarActiveClass
                    : "text-slate-700 hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
                )}
              >
                <item.icon className={cn(isCompactSidebar ? "h-4.5 w-4.5" : "h-[clamp(1rem,0.9rem+0.25vh,1.2rem)] w-[clamp(1rem,0.9rem+0.25vh,1.2rem)]")} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}

          {isSubscriptionLocked ? (
            <div className="px-3 py-3">
              <SubscriptionGate
                active={false}
                role={user?.role}
                compact
                ctaHref="/app/account"
                ctaLabel="Manage billing"
              />
            </div>
          ) : quickActionsVisible ? (
            <div className={cn("mt-auto border-t border-slate-200/80 dark:border-slate-800/80", isCompactSidebar ? "pt-3" : "pt-[clamp(0.5rem,0.25rem+0.65vh,1rem)]")}>
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400", isCompactSidebar ? "px-3" : "px-[clamp(0.8rem,0.55rem+0.65vh,1rem)]")}>Quick Actions</p>
              <div className={cn(isCompactSidebar ? "mt-2 space-y-1.5" : "mt-[clamp(0.3rem,0.15rem+0.45vh,0.55rem)] space-y-[clamp(0.15rem,0.08rem+0.2vh,0.3rem)]")}>
              <Link
                to="/app/skills?add=1"
                onClick={(event) => {
                  event.preventDefault();
                  navigateFromSidebar("/app/skills?add=1");
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl text-slate-700 transition-all hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white",
                  isCompactSidebar ? "px-3 py-2.5" : "px-[clamp(0.8rem,0.55rem+0.65vh,1rem)] py-[clamp(0.5rem,0.3rem+0.55vh,0.75rem)]"
                )}
              >
                <Target className={cn(isCompactSidebar ? "h-4.5 w-4.5" : "h-[clamp(1rem,0.9rem+0.25vh,1.2rem)] w-[clamp(1rem,0.9rem+0.25vh,1.2rem)]")} />
                <span className="font-medium">Add Skill</span>
              </Link>
              <Link
                to="/app/evidence?add=1"
                onClick={(event) => {
                  event.preventDefault();
                  navigateFromSidebar("/app/evidence?add=1");
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl text-slate-700 transition-all hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white",
                  isCompactSidebar ? "px-3 py-2.5" : "px-[clamp(0.8rem,0.55rem+0.65vh,1rem)] py-[clamp(0.5rem,0.3rem+0.55vh,0.75rem)]"
                )}
              >
                <FolderOpen className={cn(isCompactSidebar ? "h-4.5 w-4.5" : "h-[clamp(1rem,0.9rem+0.25vh,1.2rem)] w-[clamp(1rem,0.9rem+0.25vh,1.2rem)]")} />
                <span className="font-medium">Upload Evidence</span>
              </Link>
              <Link
                to="/app/jobs?analyze=1"
                onClick={(event) => {
                  event.preventDefault();
                  navigateFromSidebar("/app/jobs?analyze=1");
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl text-slate-700 transition-all hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white",
                  isCompactSidebar ? "px-3 py-2.5" : "px-[clamp(0.8rem,0.55rem+0.65vh,1rem)] py-[clamp(0.5rem,0.3rem+0.55vh,0.75rem)]"
                )}
              >
                <Briefcase className={cn(isCompactSidebar ? "h-4.5 w-4.5" : "h-[clamp(1rem,0.9rem+0.25vh,1.2rem)] w-[clamp(1rem,0.9rem+0.25vh,1.2rem)]")} />
                <span className="font-medium">Analyze New Job</span>
              </Link>
              <Link
                to="/app/resumes"
                onClick={(event) => {
                  event.preventDefault();
                  navigateFromSidebar("/app/resumes");
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl text-slate-700 transition-all hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white",
                  isCompactSidebar ? "px-3 py-2.5" : "px-[clamp(0.8rem,0.55rem+0.65vh,1rem)] py-[clamp(0.5rem,0.3rem+0.55vh,0.75rem)]"
                )}
              >
                <FileText className={cn(isCompactSidebar ? "h-4.5 w-4.5" : "h-[clamp(1rem,0.9rem+0.25vh,1.2rem)] w-[clamp(1rem,0.9rem+0.25vh,1.2rem)]")} />
                <span className="font-medium">View Tailored Resumes</span>
              </Link>
              </div>
            </div>
          ) : <div className="mt-auto" />}
        </nav>

        <div className="shrink-0 border-t border-slate-200/80 px-[clamp(0.75rem,0.5rem+0.7vh,1rem)] py-[clamp(0.6rem,0.35rem+0.75vh,1rem)] dark:border-slate-800/80">
          <div className="mb-[clamp(0.35rem,0.15rem+0.45vh,0.75rem)] flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-[clamp(0.65rem,0.45rem+0.45vh,0.8rem)] py-[clamp(0.45rem,0.3rem+0.4vh,0.7rem)] text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            <div className="flex items-center gap-2">
              {isDark ? <Moon className="h-4 w-4 shrink-0" /> : <Sun className="h-4 w-4 shrink-0" />}
              <span className="text-[clamp(0.74rem,0.68rem+0.15vh,0.86rem)] font-medium">{isDark ? "Dark Mode" : "Light Mode"}</span>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              aria-label="Toggle dark mode"
              className="h-[18px] w-[34px] data-[state=checked]:bg-[#1E3A8A] data-[state=unchecked]:bg-amber-300 dark:data-[state=checked]:bg-amber-400 dark:data-[state=unchecked]:bg-slate-700 [&_[data-slot=switch-thumb]]:size-3 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[14px]"
            />
          </div>
          <Button
            variant="outline"
            className="h-[clamp(2.25rem,2rem+0.45vh,2.5rem)] w-full justify-start border-slate-200 bg-white/80 text-[clamp(0.78rem,0.72rem+0.16vh,0.9rem)] text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className={cn("border-b px-4 py-4 backdrop-blur-xl sm:px-8", softPanelClass, "border-white/70 dark:border-slate-800/80")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </Button>
              
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Workspace</p>
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl dark:text-slate-100">
                {currentPageTitle}
                </h2>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                asChild
                variant="ghost"
                className="relative h-11 rounded-full border border-slate-200/80 bg-white/80 px-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
              >
                <Link to="/app/account/help" aria-label="Open help requests" title="Help requests">
                  <LifeBuoy className="h-4 w-4" />
                  <span className="text-sm font-medium">Help</span>
                  {unreadHelpCount > 0 ? (
                    <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                      {unreadHelpCount}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <Button asChild variant="ghost" className="relative h-11 w-11 rounded-full border border-slate-200/80 bg-white/80 p-0 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                <Link to="/app/account" aria-label="Open account settings" title="Account Settings">
                  <Avatar>
                    {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt={`${displayName} avatar`} /> : null}
                    <AvatarFallback className={`${avatarPresetClass(user?.avatar_preset) ?? activeHeaderTheme.avatarClass} text-white`}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col">
            {isSubscriptionLocked && !isAccountPage ? (
              <div className="flex min-h-full items-start justify-center py-6 sm:py-10">
                <div className="w-full max-w-3xl">
                  <SubscriptionGate
                    active={false}
                    role={user?.role}
                    ctaHref="/app/account"
                    ctaLabel="Open account"
                  />
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
        <GetStartedAgent />
      </div>
    </div>
  );
}
