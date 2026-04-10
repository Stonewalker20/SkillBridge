import { Link, useLocation } from "react-router";
import { Award, BookOpen, Cpu, LifeBuoy, SlidersHorizontal, User } from "lucide-react";
import { cn } from "./ui/utils";
import { useHeaderTheme } from "../lib/headerTheme";
import { useAuth } from "../context/AuthContext";

const LINKS = [
  {
    href: "/app/account",
    label: "Profile & Security",
    icon: User,
    match: (pathname: string) => pathname === "/app/account",
  },
  {
    href: "/app/account/personalization",
    label: "Personalization",
    icon: SlidersHorizontal,
    match: (pathname: string) => pathname.startsWith("/app/account/personalization"),
  },
  {
    href: "/app/account/ai",
    label: "AI Settings",
    icon: Cpu,
    match: (pathname: string) => pathname.startsWith("/app/account/ai"),
  },
  {
    href: "/app/account/achievements",
    label: "Achievements",
    icon: Award,
    match: (pathname: string) => pathname.startsWith("/app/account/achievements"),
  },
  {
    href: "/app/account/help",
    label: "Help Requests",
    icon: LifeBuoy,
    match: (pathname: string) => pathname === "/app/account/help",
  },
  {
    href: "/app/account/help/walkthrough",
    label: "Guide",
    icon: BookOpen,
    match: (pathname: string) => pathname.startsWith("/app/account/help/walkthrough"),
  },
];

export function AccountSectionNav() {
  const location = useLocation();
  const { activeHeaderTheme } = useHeaderTheme();
  const { user } = useAuth();
  const unreadHelpCount = Math.max(0, Number(user?.help_unread_response_count ?? 0) || 0);

  return (
    <div className="flex flex-wrap gap-1.5">
      {LINKS.map((link) => {
        const isActive = link.match(location.pathname);
        const showUnreadHelpCount = link.href === "/app/account/help" && unreadHelpCount > 0;
        return (
          <Link
            key={link.href}
            to={link.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium leading-none transition-colors sm:text-sm",
              isActive
                ? `${activeHeaderTheme.buttonClass} border-transparent`
                : "border-slate-200 bg-white/85 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800"
            )}
          >
            <link.icon className="h-3.5 w-3.5" />
            {link.label}
            {showUnreadHelpCount ? (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {unreadHelpCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
