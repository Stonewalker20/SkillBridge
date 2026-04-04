import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "./ui/switch";

export function PublicThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/85 px-3 py-2 text-slate-700 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200">
      <div className="flex items-center gap-2">
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        <span className="text-sm font-medium">{isDark ? "Dark" : "Light"}</span>
      </div>
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label="Toggle dark mode"
        className="h-[18px] w-[34px] data-[state=checked]:bg-[#1E3A8A] data-[state=unchecked]:bg-amber-300 dark:data-[state=checked]:bg-amber-400 dark:data-[state=unchecked]:bg-slate-700 [&_[data-slot=switch-thumb]]:size-3 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[14px]"
      />
    </div>
  );
}
