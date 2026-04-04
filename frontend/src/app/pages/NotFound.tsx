import { Link } from "react-router";
import { AlertCircle } from "lucide-react";
import { Button } from "../components/ui/button";

export function NotFound() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff,_#f8fafc)] px-8 py-12 text-center shadow-lg">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
          <AlertCircle className="h-10 w-10 text-slate-400" />
        </div>
        <h1 className="mt-6 text-5xl font-bold text-gray-900">404</h1>
        <p className="mt-3 text-base text-gray-600">The page you were trying to reach does not exist or has moved.</p>
        <Button asChild className="mt-8 bg-[#1E3A8A] hover:bg-[#1e3a8a]/90">
          <Link to="/">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
