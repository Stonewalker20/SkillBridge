import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { ActivityProvider } from "./context/ActivityContext";
import { Toaster } from "sonner";

function App() {
  return (
    <AuthProvider>
      <ActivityProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" />
      </ActivityProvider>
    </AuthProvider>
  );
}

export default App;
