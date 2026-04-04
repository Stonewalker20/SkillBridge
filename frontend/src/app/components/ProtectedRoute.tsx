import { Navigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length) {
    const role = String(user?.role ?? "user").toLowerCase();
    const normalized = allowedRoles.map((value) => value.toLowerCase());
    if (!normalized.includes(role)) {
      return <Navigate to="/app" replace />;
    }
  }

  return <>{children}</>;
}
