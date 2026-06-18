import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  canvasConnected: boolean | null;
  refreshCanvasStatus: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  canvasConnected: null,
  refreshCanvasStatus: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [canvasConnected, setCanvasConnected] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  // Wire Supabase JWT into the api-client
  useEffect(() => {
    setAuthTokenGetter(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });

    return () => {
      setAuthTokenGetter(null);
    };
  }, []);

  const refreshCanvasStatus = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setCanvasConnected(null);
      return;
    }
    try {
      const res = await fetch("/api/user/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setCanvasConnected(false);
        return;
      }
      const body = (await res.json()) as { canvasConnected?: boolean };
      setCanvasConnected(Boolean(body.canvasConnected));
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      setCanvasConnected(false);
    }
  }, [queryClient]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Once the session is confirmed, ask the API if Canvas is set up.
  useEffect(() => {
    if (loading) return;
    if (!session) {
      setCanvasConnected(null);
      return;
    }
    void refreshCanvasStatus();
  }, [session, loading, refreshCanvasStatus]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setCanvasConnected(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, canvasConnected, refreshCanvasStatus, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
