import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { ActivityProvider } from "./context/ActivityContext";
import { ThemeProvider } from "next-themes";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <ActivityProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" />
        </ActivityProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
