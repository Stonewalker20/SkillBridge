import { Link, useLocation } from "react-router";
import { Award, SlidersHorizontal, User } from "lucide-react";
import { cn } from "./ui/utils";
import { useHeaderTheme } from "../lib/headerTheme";

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
    href: "/app/account/achievements",
    label: "Achievements",
    icon: Award,
    match: (pathname: string) => pathname.startsWith("/app/account/achievements"),
  },
];

export function AccountSectionNav() {
  const location = useLocation();
  const { activeHeaderTheme } = useHeaderTheme();

  return (
    <div className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const isActive = link.match(location.pathname);
        return (
          <Link
            key={link.href}
            to={link.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? `${activeHeaderTheme.buttonClass} border-transparent`
                : "border-slate-200 bg-white/85 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800"
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
