"use client";

import {
  useGetMe,
  getGetMeQueryKey,
  useCanvasSync,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Database, Terminal, Shield, Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AppLayout } from "@/components/layout/AppLayout";

function SettingsContent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const syncMutation = useCanvasSync();

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (res) => {
        if (res.success) {
          toast({
            title: "SYNC COMPLETE",
            description: `Extracted ${res.courseCount} courses and ${res.assignmentCount} assignments.`,
          });
          queryClient.invalidateQueries();
        } else {
          toast({
            title: "SYNC FAILED",
            description: res.message || "Unknown error during extraction.",
            variant: "destructive",
          });
        }
      },
      onError: () => {
        toast({
          title: "SYNC FAILURE",
          description: "Connection to core systems severed.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-8">
        <Settings2 className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold font-mono uppercase tracking-widest text-foreground">
          System Configuration
        </h1>
      </div>

      <div className="space-y-6">
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="border-b border-border bg-background pb-4">
            <CardTitle className="font-mono text-sm tracking-widest uppercase flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Core Link Status
            </CardTitle>
            <CardDescription className="font-mono text-xs uppercase">
              Canvas LMS Connection State
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-background border border-border">
              <div className="flex items-center gap-4">
                <div
                  className={`w-3 h-3 rounded-full ${me?.canvasConnected ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-destructive animate-pulse"}`}
                />
                <div>
                  <h3 className="font-mono font-bold uppercase text-sm">
                    {me?.canvasConnected ? "Link Secure" : "Link Offline"}
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground mt-1">
                    {me?.canvasBaseUrl || "No endpoint configured"}
                  </p>
                </div>
              </div>
              <div className="font-mono text-xs text-muted-foreground uppercase border border-border px-3 py-1">
                PAT AUTHENTICATED
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border bg-card">
          <CardHeader className="border-b border-border bg-background pb-4">
            <CardTitle className="font-mono text-sm tracking-widest uppercase flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" /> Data Extraction
            </CardTitle>
            <CardDescription className="font-mono text-xs uppercase">
              Manual Database Synchronization
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col sm:flex-row gap-6 items-center justify-between">
            <div className="text-sm text-muted-foreground max-w-lg">
              Forces an immediate pull from Canvas LMS endpoints. Updates local
              cache with latest assignments, courses, and grade calculations.
            </div>
            <Button
              onClick={handleSync}
              disabled={syncMutation.isPending || !me?.canvasConnected}
              className="rounded-none font-mono uppercase tracking-widest border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground h-12 px-6 shrink-0 w-full sm:w-auto"
            >
              {syncMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />{" "}
                  EXTRACTING...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" /> FORCE SYNC
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border bg-card opacity-70">
          <CardHeader className="border-b border-border bg-background pb-4">
            <CardTitle className="font-mono text-sm tracking-widest uppercase flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" /> Voice Protocols
            </CardTitle>
            <CardDescription className="font-mono text-xs uppercase">
              Terminal Interaction Settings
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-mono text-sm uppercase">
                  Text-to-Speech Output
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Enable CARVIS vocal responses
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-mono text-sm uppercase">
                  Continuous Listening
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Maintain open mic channel (Requires HTTPS)
                </p>
              </div>
              <Switch disabled />
            </div>
            <p className="text-[10px] font-mono text-primary uppercase mt-4">
              [LOCKED] Hardware limits restrict modification of these parameters.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppLayout>
      <SettingsContent />
    </AppLayout>
  );
}
