import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PasswordProvider } from "@/context/PasswordContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LockProvider, useLock } from "@/context/LockContext";
import LockScreen from "@/components/LockScreen";
import Index from "./pages/Index.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isUnlocked } = useLock();
  
  if (loading) return null; // ou um spinner
  if (!user) return <AuthPage />;
  if (!isUnlocked) return <LockScreen />;
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <LockProvider>
          <PasswordProvider>
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </PasswordProvider>
        </LockProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
