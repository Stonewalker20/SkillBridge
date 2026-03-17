import { Suspense, lazy } from "react";
import { Navigate } from "react-router";
import { useAccountPreferences } from "../context/AccountPreferencesContext";

const Dashboard = lazy(() => import("../pages/Dashboard").then((module) => ({ default: module.Dashboard })));

export function AppHome() {
  const { preferences } = useAccountPreferences();

  if (preferences.startPage === "/app") {
    return (
      <Suspense fallback={<div className="p-6 text-sm text-gray-600 dark:text-slate-300">Loading dashboard...</div>}>
        <Dashboard />
      </Suspense>
    );
  }

  return <Navigate to={preferences.startPage} replace />;
}
