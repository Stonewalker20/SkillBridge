import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { 
  LayoutDashboard, 
  Briefcase, 
  FolderOpen, 
  FileText,
  Target,
  Menu,
  X,
  LogOut
} from "lucide-react";
import { cn } from "./ui/utils";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import LogoSvg from "../../imports/file.svg";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { name: "Skills", href: "/app/skills", icon: Target },
  { name: "Evidence", href: "/app/evidence", icon: FolderOpen },
  { name: "Job Match", href: "/app/jobs", icon: Briefcase },
];

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayName = user?.username || user?.email?.split("@")[0] || "Account";
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

  const handleOpenNewJobAnalysis = () => {
    setMobileMenuOpen(false);
    navigate(`/app/jobs?new=${Date.now()}`);
  };

  const currentPageTitle =
    location.pathname === "/app/account"
      ? "Account"
      : navigation.find((item) => item.href === location.pathname)?.name || "Page";

  return (
    <div className="flex h-screen bg-[linear-gradient(180deg,_#f8fafc,_#eef2ff_45%,_#f8fafc)]">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 border-r border-slate-200/70 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(241,245,249,0.96))] backdrop-blur-xl flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Close button for mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <X className="h-6 w-6" />
        </Button>

        <div className="border-b border-slate-200/80 px-6 py-6">
          <Link to="/app" className="flex items-center justify-center rounded-2xl px-1 py-2 transition-opacity hover:opacity-90">
            <img
              src={LogoSvg}
              alt="SkillBridge Logo"
              className="h-28 w-full max-w-[280px] object-contain"
            />
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 transition-all",
                  isActive
                    ? "bg-[linear-gradient(135deg,_#1E3A8A,_#0F766E)] text-white shadow-sm"
                    : "text-slate-700 hover:bg-white/80 hover:text-slate-900"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}

          <div className="mt-6 border-t border-slate-200/80 pt-4">
            <p className="px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick Actions</p>
            <div className="mt-2 space-y-1">
              <Link
                to="/app/jobs?analyze=1"
                onClick={(event) => {
                  event.preventDefault();
                  handleOpenNewJobAnalysis();
                }}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-700 transition-all hover:bg-white/80 hover:text-slate-900"
              >
                <Briefcase className="h-5 w-5" />
                <span className="font-medium">Analyze New Job</span>
              </Link>
              <Link
                to="/app/skills?add=1"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-700 transition-all hover:bg-white/80 hover:text-slate-900"
              >
                <Target className="h-5 w-5" />
                <span className="font-medium">Add Skill</span>
              </Link>
              <Link
                to="/app/evidence?add=1"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-700 transition-all hover:bg-white/80 hover:text-slate-900"
              >
                <FolderOpen className="h-5 w-5" />
                <span className="font-medium">Upload Evidence</span>
              </Link>
              <Link
                to="/app/resumes"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-700 transition-all hover:bg-white/80 hover:text-slate-900"
              >
                <FileText className="h-5 w-5" />
                <span className="font-medium">View Tailored Resumes</span>
              </Link>
            </div>
          </div>
        </nav>

        <div className="border-t border-slate-200/80 p-4">
          <Button
            variant="outline"
            className="w-full justify-start border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-white/70 bg-white/70 px-4 py-4 backdrop-blur-xl sm:px-8">
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
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Workspace</p>
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                {currentPageTitle}
                </h2>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <Button asChild variant="ghost" className="relative h-11 w-11 rounded-full border border-slate-200/80 bg-white/80 p-0 shadow-sm">
                <Link to="/app/account" aria-label="Open account settings" title="Account Settings">
                  <Avatar>
                    <AvatarFallback className="bg-[linear-gradient(135deg,_#1E3A8A,_#0F766E)] text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
