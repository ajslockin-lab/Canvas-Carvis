import React, { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { OrbCanvas } from "@/components/OrbCanvas";
import { Button } from "@/components/ui/button";
import { ChevronRight, Database, Terminal, Cpu } from "lucide-react";

export default function Landing() {
  const [location, setLocation] = useLocation();
  const { data: me, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  // Auto-redirect if already signed in
  useEffect(() => {
    if (me && !isLoading) {
      setLocation("/dashboard");
    }
  }, [me, isLoading, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden selection:bg-primary/30">
      
      {/* HUD Grid Overlay */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      <div className="pointer-events-none fixed inset-0 opacity-10 bg-[radial-gradient(circle_at_center,transparent_0%,#060911_100%)]"></div>

      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <span className="font-mono font-bold tracking-widest text-xl">CARVIS_</span>
        </div>
        <nav className="flex gap-4">
          <Link href="/signin">
            <Button variant="outline" className="font-mono rounded-none border-border bg-transparent text-muted-foreground hover:text-primary hover:border-primary/50 uppercase text-xs tracking-wider">
              Init_Session
            </Button>
          </Link>
          <Link href="/signin">
            <Button className="font-mono rounded-none bg-primary text-primary-foreground hover:bg-primary/90 uppercase text-xs tracking-wider">
              Launch_HUD
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        
        {/* The Orb Centered */}
        <div className="w-[500px] h-[500px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70 pointer-events-none mix-blend-screen">
          <OrbCanvas state="idle" />
        </div>

        <div className="text-center max-w-3xl relative z-10 mt-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-card border border-border mb-8 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-primary/80 rounded-full"></span>
            Academic Copilot Online
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Command Your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-500">Academic Trajectory.</span>
          </h1>
          
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            Not a productivity tool. A heads-up display for your Canvas LMS. Connect your courses, talk to your data, and execute assignments with ruthless precision.
          </p>

          <Link href="/signin">
            <Button size="lg" className="h-14 px-8 text-sm font-mono tracking-widest uppercase rounded-none bg-card border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 group">
              Establish Uplink
              <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </main>

      {/* Features Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-t border-border z-10 bg-background/80 backdrop-blur">
        <div className="p-8 border-r border-border hover:bg-card/50 transition-colors">
          <Database className="w-6 h-6 text-primary mb-4" />
          <h3 className="font-mono text-sm tracking-widest uppercase mb-2">Total Sync</h3>
          <p className="text-sm text-muted-foreground">Real-time data extraction from Canvas LMS. Assignments, grades, and syllabi loaded directly into memory.</p>
        </div>
        <div className="p-8 border-r border-border hover:bg-card/50 transition-colors">
          <Terminal className="w-6 h-6 text-primary mb-4" />
          <h3 className="font-mono text-sm tracking-widest uppercase mb-2">Voice Interface</h3>
          <p className="text-sm text-muted-foreground">Natural language queries via the CARVIS terminal. Ask about deadlines, summarize materials, formulate action plans.</p>
        </div>
        <div className="p-8 hover:bg-card/50 transition-colors">
          <Cpu className="w-6 h-6 text-primary mb-4" />
          <h3 className="font-mono text-sm tracking-widest uppercase mb-2">Tactical HUD</h3>
          <p className="text-sm text-muted-foreground">Zero friction, pure signal. Dense information architecture designed for high-performance students.</p>
        </div>
      </div>
    </div>
  );
}