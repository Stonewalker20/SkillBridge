import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";

const Landing = lazy(() => import("./pages/Landing").then((module) => ({ default: module.Landing })));
const Login = lazy(() => import("./pages/Login").then((module) => ({ default: module.Login })));
const SignUp = lazy(() => import("./pages/SignUp").then((module) => ({ default: module.SignUp })));
const Skills = lazy(() => import("./pages/Skills").then((module) => ({ default: module.Skills })));
const Evidence = lazy(() => import("./pages/Evidence").then((module) => ({ default: module.Evidence })));
const Jobs = lazy(() => import("./pages/Jobs").then((module) => ({ default: module.Jobs })));
const Account = lazy(() => import("./pages/Account").then((module) => ({ default: module.Account })));
const AccountPersonalization = lazy(() =>
  import("./pages/AccountPersonalization").then((module) => ({ default: module.AccountPersonalization }))
);
const NotFound = lazy(() => import("./pages/NotFound").then((module) => ({ default: module.NotFound })));
const TailoredResumes = lazy(() => import("./pages/TailoredResumes").then((module) => ({ default: module.TailoredResumes })));
const Admin = lazy(() => import("./pages/Admin").then((module) => ({ default: module.Admin })));
const AdminMlflow = lazy(() => import("./pages/AdminMlflow").then((module) => ({ default: module.AdminMlflow })));
const SkillAnalytics = lazy(() => import("./pages/SkillAnalytics").then((module) => ({ default: module.SkillAnalytics })));
const CareerPathDetail = lazy(() => import("./pages/CareerPathDetail").then((module) => ({ default: module.CareerPathDetail })));
const AppHome = lazy(() => import("./components/AppHome").then((module) => ({ default: module.AppHome })));

function RouteLoading() {
  return <div className="p-6 text-sm text-gray-600 dark:text-slate-300">Loading...</div>;
}

function suspense(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    children: [
      {
        index: true,
        element: suspense(<Landing />),
      },
      {
        path: "login",
        element: suspense(<Login />),
      },
      {
        path: "signup",
        element: suspense(<SignUp />),
      },
    ],
  },
  {
    path: "/app",
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: suspense(<AppHome />) },
      { path: "skills", element: suspense(<Skills />) },
      { path: "evidence", element: suspense(<Evidence />) },
      { path: "jobs", element: suspense(<Jobs />) },
      { path: "resumes", element: suspense(<TailoredResumes />) },
      { path: "analytics/skills", element: suspense(<SkillAnalytics />) },
      { path: "analytics/career-paths/:roleId", element: suspense(<CareerPathDetail />) },
      { path: "account", element: suspense(<Account />) },
      { path: "account/personalization", element: suspense(<AccountPersonalization />) },
      {
        path: "admin",
        element: (
          <ProtectedRoute allowedRoles={["owner", "admin", "team"]}>
            {suspense(<Admin />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/mlflow",
        element: (
          <ProtectedRoute allowedRoles={["owner", "admin", "team"]}>
            {suspense(<AdminMlflow />)}
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "*",
    element: suspense(<NotFound />),
  },
]);
