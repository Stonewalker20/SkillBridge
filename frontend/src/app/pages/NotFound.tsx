import { Link } from "react-router";
import { AlertCircle } from "lucide-react";
import { Button } from "../components/ui/button";

export function NotFound() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <p className="text-gray-600 mb-6">Page not found</p>
        <Button asChild>
          <Link to="/">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
