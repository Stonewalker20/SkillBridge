import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { api, type AuthUser } from "../services/api";

type User = AuthUser;

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: bootstrapping,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
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
