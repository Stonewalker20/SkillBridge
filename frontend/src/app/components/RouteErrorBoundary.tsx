import { AlertCircle, Home, RefreshCcw } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { DocumentTitle } from "./DocumentTitle";

interface RouteErrorBoundaryProps {
  scope?: "public" | "app";
}

function getErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return error.data?.message || error.statusText || `Request failed with status ${error.status}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong while loading this page.";
}

export function RouteErrorBoundary({ scope = "public" }: RouteErrorBoundaryProps) {
  const error = useRouteError();
  const message = getErrorMessage(error);
  const isAppScope = scope === "app";

  return (
    <div className="flex min-h-svh items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(30,58,138,0.08),_transparent_45%),linear-gradient(180deg,_#f8fafc,_#eef2ff)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.12),_transparent_45%),linear-gradient(180deg,_#020617,_#0f172a)]">
      <DocumentTitle title="Application Error" />
      <Card className="w-full max-w-2xl rounded-[2rem] border-slate-200/80 bg-white/95 p-8 shadow-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-8 w-8" />
        </div>
        <div className="mt-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Application Error</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            This page hit an unexpected error
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            The request did not complete cleanly. You can retry this page or return to a stable section of SkillBridge.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
          {message}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={() => window.location.reload()}>
            <RefreshCcw className="h-4 w-4" />
            Reload page
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to={isAppScope ? "/app" : "/"}>
              <Home className="h-4 w-4" />
              {isAppScope ? "Go to dashboard" : "Go to home"}
            </Link>
          </Button>
          {isAppScope ? (
            <Button asChild type="button" variant="ghost">
              <Link to="/app/account">Open account</Link>
            </Button>
          ) : (
            <Button asChild type="button" variant="ghost">
              <Link to="/login">Open login</Link>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
