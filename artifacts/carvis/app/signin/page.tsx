"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthCanvasPat } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, LockKeyhole, Terminal } from "lucide-react";

const patSchema = z.object({
  canvasUrl: z
    .string()
    .url("Must be a valid URL (e.g., https://canvas.instructure.com)"),
  pat: z
    .string()
    .min(10, "PAT looks too short. Provide a valid Personal Access Token."),
});

export default function SignIn() {
  const router = useRouter();
  const { toast } = useToast();
  const patMutation = useAuthCanvasPat();

  const form = useForm<z.infer<typeof patSchema>>({
    resolver: zodResolver(patSchema),
    defaultValues: {
      canvasUrl: "https://canvas.instructure.com",
      pat: "",
    },
  });

  const onSubmit = (values: z.infer<typeof patSchema>) => {
    patMutation.mutate(
      { data: values },
      {
        onSuccess: (res) => {
          if (res.success) {
            toast({
              title: "UPLINK ESTABLISHED",
              description: "Authentication verified. Initializing HUD...",
            });
            router.push("/dashboard");
          } else {
            toast({
              title: "ACCESS DENIED",
              description: "Invalid credentials provided.",
              variant: "destructive",
            });
          }
        },
        onError: () => {
          toast({
            title: "CONNECTION FAILURE",
            description: "Could not contact authentication server.",
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
            System Access
          </h1>
          <p className="text-muted-foreground text-sm font-mono tracking-wider mt-2">
            Enter credentials to proceed
          </p>
        </div>

        <Card className="rounded-none border-border bg-card shadow-2xl shadow-primary/5">
          <CardHeader className="border-b border-border bg-muted/20 pb-4">
            <CardTitle className="font-mono text-sm tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Canvas LMS PAT Auth
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              Generate a Personal Access Token in your Canvas Account Settings
              &gt; Approved Integrations.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="canvasUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                        Institution URL
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://canvas.instructure.com"
                          className="font-mono bg-background border-border rounded-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-sm h-12"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs text-destructive" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                        Personal Access Token
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="password"
                            placeholder="7~XXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                            className="font-mono pl-10 bg-background border-border rounded-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-sm h-12"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="font-mono text-xs text-destructive" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={patMutation.isPending}
                  className="w-full rounded-none h-12 font-mono uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-all border border-primary hover:shadow-[0_0_15px_rgba(255,68,68,0.4)]"
                >
                  {patMutation.isPending
                    ? "Authenticating..."
                    : "Initialize Link"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            CARVIS secure terminal // V1.0.0 // Auth protocol standard
          </p>
        </div>
      </div>
    </div>
  );
}
