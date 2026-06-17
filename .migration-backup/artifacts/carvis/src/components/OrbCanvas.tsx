import React, { useEffect, useRef } from "react";
import { createOrb, Orb, OrbState } from "@/lib/carvisOrb";

export interface OrbCanvasProps {
  state?: OrbState;
  className?: string;
  analyser?: AnalyserNode | null;
}

export function OrbCanvas({ state = "idle", className = "", analyser = null }: OrbCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<Orb | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let orb: import("@/lib/carvisOrb").Orb | null = null;
    try {
      orb = createOrb(canvasRef.current);
      orbRef.current = orb;
    } catch {
      // WebGL not available in this environment — orb degrades gracefully
    }
    return () => { orb?.destroy(); };
  }, []);

  useEffect(() => {
    if (orbRef.current) {
      orbRef.current.setState(state);
    }
  }, [state]);

  useEffect(() => {
    if (orbRef.current) {
      orbRef.current.setAnalyser(analyser);
    }
  }, [analyser]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`block w-full h-full object-cover ${className}`} 
    />
  );
}