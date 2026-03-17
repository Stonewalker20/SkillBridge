import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { ActivityProvider } from "./context/ActivityContext";
import { AccountPreferencesProvider } from "./context/AccountPreferencesContext";
import { ThemeProvider } from "next-themes";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <AccountPreferencesProvider>
          <ActivityProvider>
            <RouterProvider router={router} />
            <Toaster position="top-right" />
          </ActivityProvider>
        </AccountPreferencesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
