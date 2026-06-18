import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuthCanvasPat } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Terminal, Shield, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/AuthProvider";

export default function CanvasSetup() {
  const [, setLocation] = useLocation();
  const { refreshCanvasStatus } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [canvasUrl, setCanvasUrl] = useState("");
  const [pat, setPat] = useState("");

  const submitPat = useAuthCanvasPat();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUrl = canvasUrl.trim();
    const trimmedPat = pat.trim();
    if (!trimmedUrl || !trimmedPat) {
      toast({
        title: "MISSING FIELDS",
        description: "Both Canvas URL and access token are required.",
        variant: "destructive",
      });
      return;
    }

    submitPat.mutate(
      { data: { canvasUrl: trimmedUrl, pat: trimmedPat } },
      {
        onSuccess: async (res) => {
          if (res?.success) {
            toast({
              title: "LINK ESTABLISHED",
              description: "Canvas credentials accepted. Loading dashboard.",
            });
            await refreshCanvasStatus();
            queryClient.invalidateQueries();
            setLocation("/dashboard");
          } else {
            toast({
              title: "LINK REJECTED",
              description: "Could not validate credentials. Check the URL and PAT.",
              variant: "destructive",
            });
          }
        },
        onError: () => {
          toast({
            title: "CONNECTION FAILED",
            description: "Unable to reach core systems. Try again in a moment.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Terminal className="w-12 h-12 text-primary mb-4" />
          <h1 className="font-mono text-2xl font-bold tracking-widest text-foreground uppercase">
            Canvas Link
          </h1>
          <p className="text-muted-foreground text-sm font-mono tracking-wider mt-2 text-center">
            Authenticate with your institution's Canvas to continue
          </p>
        </div>

        <Card className="rounded-none border-border bg-card shadow-2xl shadow-primary/5">
          <CardHeader className="border-b border-border bg-muted/20 pb-4">
            <CardTitle className="font-mono text-sm tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Personal Access Token
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              Credentials are encrypted at rest
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="canvas-url"
                  className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
                >
                  Canvas URL
                </Label>
                <Input
                  id="canvas-url"
                  type="url"
                  placeholder="https://school.instructure.com"
                  value={canvasUrl}
                  onChange={(e) => setCanvasUrl(e.target.value)}
                  className="font-mono rounded-none border-border bg-background"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={submitPat.isPending}
                />
                <p className="text-[10px] font-mono text-muted-foreground">
                  Must be a valid school.instructure.com endpoint.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="canvas-pat"
                  className="font-mono text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2"
                >
                  <KeyRound className="w-3 h-3" />
                  Access Token
                </Label>
                <Input
                  id="canvas-pat"
                  type="password"
                  placeholder="paste your PAT here"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  className="font-mono rounded-none border-border bg-background"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={submitPat.isPending}
                />
                <a
                  href="https://community.canvaslms.com/t5/Canvas-Basics-Guide/How-do-I-manage-API-access-tokens-in-Canvas/ta-p/267312"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-primary hover:underline inline-flex items-center gap-1"
                >
                  How do I get a Canvas PAT?
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>

              <Button
                type="submit"
                disabled={submitPat.isPending}
                className="w-full rounded-none font-mono uppercase tracking-widest border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground h-12"
              >
                {submitPat.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Establish Link
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            CARVIS secure terminal // V0.1.0 // Step 2 of 2
          </p>
        </div>
      </div>
    </div>
  );
}
