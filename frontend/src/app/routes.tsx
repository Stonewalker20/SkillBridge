import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";
import { Dashboard } from "./pages/Dashboard";
import { Skills } from "./pages/Skills";
import { Evidence } from "./pages/Evidence";
import { Jobs } from "./pages/Jobs";
import { Account } from "./pages/Account";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    children: [
      {
        index: true,
        element: <Landing />,
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "signup",
        element: <SignUp />,
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
      { index: true, element: <Dashboard /> },
      { path: "skills", element: <Skills /> },
      { path: "evidence", element: <Evidence /> },
      { path: "jobs", element: <Jobs /> },
      { path: "account", element: <Account /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);