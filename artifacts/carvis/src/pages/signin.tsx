import React from "react";
import { useLocation } from "wouter";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";
import { Terminal, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/components/AuthProvider";

export default function SignIn() {
  const [, setLocation] = useLocation();
  const { session, canvasConnected, loading } = useAuth();

  // Redirect based on Canvas connection state
  React.useEffect(() => {
    if (!session) return;
    if (loading) return;
    if (canvasConnected === false) {
      setLocation("/canvas-setup");
    } else if (canvasConnected === true) {
      setLocation("/dashboard");
    }
  }, [session, canvasConnected, loading, setLocation]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="pointer-events-none fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Terminal className="w-12 h-12 text-primary mb-4" />
          <h1 className="font-mono text-2xl font-bold tracking-widest text-foreground uppercase">System Access</h1>
          <p className="text-muted-foreground text-sm font-mono tracking-wider mt-2">Authenticate with Supabase</p>
        </div>

        <Card className="rounded-none border-border bg-card shadow-2xl shadow-primary/5">
          <CardHeader className="border-b border-border bg-muted/20 pb-4">
            <CardTitle className="font-mono text-sm tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Supabase Auth
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              Email + password, or magic link
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              providers={["github", "google"]}
              redirectTo={`${window.location.origin}/dashboard`}
              theme="dark"
            />
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            CARVIS secure terminal // V0.1.0 // Auth protocol standard
          </p>
        </div>
      </div>
    </div>
  );
}
