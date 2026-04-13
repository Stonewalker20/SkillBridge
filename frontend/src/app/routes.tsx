import { Fragment, Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter } from "react-router";
import { DocumentTitle } from "./components/DocumentTitle";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { RootLayout } from "./components/RootLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";

const Landing = lazy(() => import("./pages/Landing").then((module) => ({ default: module.Landing })));
const ExpoDemo = lazy(() => import("./pages/ExpoDemo").then((module) => ({ default: module.ExpoDemo })));
const Login = lazy(() => import("./pages/Login").then((module) => ({ default: module.Login })));
const SignUp = lazy(() => import("./pages/SignUp").then((module) => ({ default: module.SignUp })));
const ForgotPassword = lazy(() =>
  import("./pages/ForgotPassword").then((module) => ({ default: module.ForgotPassword }))
);
const ResetPassword = lazy(() =>
  import("./pages/ResetPassword").then((module) => ({ default: module.ResetPassword }))
);
const Skills = lazy(() => import("./pages/Skills").then((module) => ({ default: module.Skills })));
const Evidence = lazy(() => import("./pages/Evidence").then((module) => ({ default: module.Evidence })));
const Jobs = lazy(() => import("./pages/Jobs").then((module) => ({ default: module.Jobs })));
const Account = lazy(() => import("./pages/Account").then((module) => ({ default: module.Account })));
const AccountAI = lazy(() => import("./pages/AccountAI").then((module) => ({ default: module.AccountAI })));
const AccountPersonalization = lazy(() =>
  import("./pages/AccountPersonalization").then((module) => ({ default: module.AccountPersonalization }))
);
const AccountAchievements = lazy(() =>
  import("./pages/AccountAchievements").then((module) => ({ default: module.AccountAchievements }))
);
const AccountHelp = lazy(() => import("./pages/AccountHelp").then((module) => ({ default: module.AccountHelp })));
const AccountHelpGuide = lazy(() =>
  import("./pages/AccountHelpGuide").then((module) => ({ default: module.AccountHelpGuide }))
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

function page(title: string | undefined, element: ReactNode) {
  return suspense(
    <Fragment>
      <DocumentTitle title={title} />
      {element}
    </Fragment>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <RouteErrorBoundary scope="public" />,
    children: [
      {
        index: true,
        element: page("SkillBridge", <Landing />),
      },
      {
        path: "expo-demo",
        element: page("SkillBridge Expo Demo", <ExpoDemo />),
      },
      {
        path: "login",
        element: page("Login", <Login />),
      },
      {
        path: "signup",
        element: page("Sign Up", <SignUp />),
      },
      {
        path: "forgot-password",
        element: page("Forgot Password", <ForgotPassword />),
      },
      {
        path: "reset-password",
        element: page("Reset Password", <ResetPassword />),
      },
    ],
  },
  {
    path: "/app",
    errorElement: <RouteErrorBoundary scope="app" />,
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: page("Dashboard", <AppHome />) },
      { path: "skills", element: page("Skills", <Skills />) },
      { path: "evidence", element: page("Evidence", <Evidence />) },
      { path: "jobs", element: page("Job Match", <Jobs />) },
      { path: "resumes", element: page("Tailored Resumes", <TailoredResumes />) },
      { path: "analytics/skills", element: page("Skill Analytics", <SkillAnalytics />) },
      { path: "analytics/career-paths/:roleId", element: page("Career Path", <CareerPathDetail />) },
      { path: "account", element: page("Account", <Account />) },
      { path: "account/ai", element: page("AI Settings", <AccountAI />) },
      { path: "account/personalization", element: page("Personalization", <AccountPersonalization />) },
      { path: "account/achievements", element: page("Achievements", <AccountAchievements />) },
      { path: "account/help", element: page("Help", <AccountHelp />) },
      { path: "account/help/walkthrough", element: page("Help Guide", <AccountHelpGuide />) },
      {
        path: "admin",
        element: (
          <ProtectedRoute allowedRoles={["owner", "admin", "team"]}>
            {page("Admin", <Admin />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/mlflow",
        element: (
          <ProtectedRoute allowedRoles={["owner", "admin", "team"]}>
            {page("Admin MLflow", <AdminMlflow />)}
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "*",
    element: page("Page Not Found", <NotFound />),
  },
]);
