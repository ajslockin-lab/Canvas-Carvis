import React from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LayoutDashboard, Settings, LogOut, CheckCircle2, AlertTriangle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const [location, setLocation] = useLocation();
  const logout = useLogout();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (!me) {
    setLocation("/signin");
    return null;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/");
      }
    });
  };

  return (
    <div className="min-h-screen w-full bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col h-screen sticky top-0 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2 font-mono font-bold tracking-tight text-xl text-primary">
            <span className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-[0_0_12px_rgba(255,68,68,0.6)]"></span>
            CARVIS
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/dashboard">
            <div className={`flex items-center gap-3 px-3 py-2 rounded font-mono text-sm transition-colors cursor-pointer ${location === "/dashboard" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              <LayoutDashboard className="w-4 h-4" />
              HUD_DASHBOARD
            </div>
          </Link>
          <Link href="/settings">
            <div className={`flex items-center gap-3 px-3 py-2 rounded font-mono text-sm transition-colors cursor-pointer ${location === "/settings" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              <Settings className="w-4 h-4" />
              SYS_CONFIG
            </div>
          </Link>
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-3 mb-2 rounded bg-card border border-border">
            <Avatar className="w-8 h-8 border border-primary/30 rounded">
              <AvatarFallback className="bg-transparent font-mono text-xs text-primary rounded">
                {me.name?.substring(0,2).toUpperCase() || "US"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono font-bold text-foreground truncate">{me.name || "OPERATOR"}</p>
              <p className="text-[10px] font-mono text-muted-foreground truncate">{me.email}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full font-mono text-xs justify-start text-muted-foreground hover:text-destructive border-border hover:border-destructive/50" 
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            {logout.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            TERM_SESSION
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-background">
        <div className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
          <div className="font-mono text-sm text-muted-foreground tracking-widest uppercase">
            {location.replace("/", "").replace("-", "_") || "INITIALIZING..."}
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-2 py-1 rounded border text-[10px] font-mono tracking-wider flex items-center gap-1.5 ${me.canvasConnected ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${me.canvasConnected ? 'bg-emerald-500' : 'bg-destructive animate-pulse'}`} />
              {me.canvasConnected ? 'LINK_SECURE' : 'LINK_OFFLINE'}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}