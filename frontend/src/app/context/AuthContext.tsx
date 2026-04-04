import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { api, type AuthUser } from "../services/api";

type User = AuthUser;

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [lastHelpUnreadCount, setLastHelpUnreadCount] = useState<number | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const bootstrap = async () => {
      setBootstrapping(true);
      try {
        // If a token exists, validate it by calling /auth/me.
        if (api.getToken()) {
          const me = await api.me();
          setUser(me);
        }
      } catch {
        // Token invalid/stale; api.request() clears it on 401.
        setUser(null);
      } finally {
        setBootstrapping(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const out = await api.login({ email, password });
    setUser(out.user);
  };

  const signup = async (username: string, email: string, password: string) => {
    const out = await api.register({ username, email, password });
    setUser(out.user);
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const me = await api.me();
    setUser(me);
  };

  useEffect(() => {
    if (bootstrapping || !api.getToken()) return undefined;

    const refreshOnAttention = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refreshUser().catch(() => {
        // Keep the existing user state if the passive refresh fails.
      });
    };

    window.addEventListener("focus", refreshOnAttention);
    document.addEventListener("visibilitychange", refreshOnAttention);
    return () => {
      window.removeEventListener("focus", refreshOnAttention);
      document.removeEventListener("visibilitychange", refreshOnAttention);
    };
  }, [bootstrapping]);

  useEffect(() => {
    const currentCount = Math.max(0, Number(user?.help_unread_response_count ?? 0) || 0);
    if (!bootstrapping && lastHelpUnreadCount != null && currentCount > lastHelpUnreadCount) {
      toast.success(
        currentCount === 1 ? "You have a new help response waiting." : `You have ${currentCount} help responses waiting.`
      );
    }
    setLastHelpUnreadCount(currentCount);
  }, [bootstrapping, lastHelpUnreadCount, user?.help_unread_response_count]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: bootstrapping,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
