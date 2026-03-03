import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { 
  LayoutDashboard, 
  Briefcase, 
  FolderOpen, 
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

  const currentPageTitle =
    location.pathname === "/app/account"
      ? "Account"
      : navigation.find((item) => item.href === location.pathname)?.name || "Page";

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0",
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

        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-center">
            <img src={LogoSvg} alt="SkillBridge Logo" className="h-16 w-auto max-w-[180px]" />
          </div>
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
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive
                    ? "bg-[#1E3A8A] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          {/* Mobile Logout Button */}
          <Button
            variant="outline"
            className="w-full lg:hidden"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4">
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
              
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {currentPageTitle}
              </h2>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <Button asChild variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                <Link to="/app/account" aria-label="Open account settings" title="Account Settings">
                  <Avatar>
                    <AvatarFallback className="bg-[#1E3A8A] text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </Button>
              <Button variant="outline" onClick={handleLogout} className="hidden sm:inline-flex">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
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
