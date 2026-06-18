import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { Loader2 } from "lucide-react";

import Landing from "@/pages/landing";
import SignIn from "@/pages/signin";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";
import CanvasSetup from "@/pages/canvas-setup";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function CanvasSetupGuard({ children }: { children: React.ReactNode }) {
  const { session, canvasConnected, loading } = useAuth();
  const [, setLocation] = useLocation();

  // No session — head to sign in.
  if (session && !loading && canvasConnected === null) {
    // still checking; show a brief loader
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (session && canvasConnected === false) {
    return <CanvasSetup />;
  }

  if (!session) {
    if (typeof window !== "undefined" && window.location.pathname !== "/signin") {
      setLocation("/signin");
    }
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/signin" component={SignIn} />
      <Route path="/canvas-setup" component={CanvasSetup} />

      {/* Protected routes wrapped in AppLayout + Canvas-setup guard */}
      <Route path="/dashboard">
        {() => (
          <CanvasSetupGuard>
            <AppLayout><Dashboard /></AppLayout>
          </CanvasSetupGuard>
        )}
      </Route>
      <Route path="/settings">
        {() => (
          <CanvasSetupGuard>
            <AppLayout><Settings /></AppLayout>
          </CanvasSetupGuard>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
