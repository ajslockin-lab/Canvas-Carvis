import React, { useState, useEffect, useRef, useCallback } from "react";
import { useVoiceCommand } from "@workspace/api-client-react";
import { OrbCanvas } from "@/components/OrbCanvas";
import { OrbState } from "@/lib/carvisOrb";
import { Mic, MicOff, Terminal as TerminalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface VoiceInterfaceProps {
  onCommandSuccess?: () => void;
}

export function VoiceInterface({ onCommandSuccess }: VoiceInterfaceProps) {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [chatLog, setChatLog] = useState<{role: 'user' | 'carvis', text: string}[]>([]);
  
  const voiceCommand = useVoiceCommand();
  const { toast } = useToast();
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as Window & { SpeechRecognition?: typeof globalThis.SpeechRecognition; webkitSpeechRecognition?: typeof globalThis.SpeechRecognition }).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setOrbState("listening");
        };

        recognitionRef.current.onresult = (event: any) => {
          const current = event.resultIndex;
          const result = event.results[current][0].transcript;
          setTranscript(result);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
          setOrbState("idle");
          toast({
            title: "MIC_ERROR",
            description: `Speech recognition failed: ${event.error}`,
            variant: "destructive",
          });
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
      
      synthRef.current = window.speechSynthesis;
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [toast]);

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = synthRef.current.getVoices();
    // Try to find a distinct/robotic voice if possible
    const preferredVoice = voices.find((v: SpeechSynthesisVoice) => v.name.includes("Daniel") || v.name.includes("Google UK English Male")) || voices[0];
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.pitch = 0.8;
    utterance.rate = 1.1;

    utterance.onstart = () => setOrbState("speaking");
    utterance.onend = () => setOrbState("idle");
    utterance.onerror = () => setOrbState("idle");

    synthRef.current.speak(utterance);
  }, []);

  const processCommand = useCallback(async (text: string) => {
    if (!text.trim()) {
      setOrbState("idle");
      return;
    }

    setChatLog(prev => [...prev, { role: 'user', text }]);
    setOrbState("thinking");
    setTranscript("");

    try {
      const res = await voiceCommand.mutateAsync({ data: { text } });
      setChatLog(prev => [...prev, { role: 'carvis', text: res.response }]);
      speak(res.response);
      if (onCommandSuccess) onCommandSuccess();
    } catch (error) {
      setOrbState("idle");
      setChatLog(prev => [...prev, { role: 'carvis', text: "ERR: Connection to core systems severed." }]);
      toast({
        title: "COMMAND_FAILED",
        description: "Failed to process voice command.",
        variant: "destructive",
      });
    }
  }, [voiceCommand, speak, onCommandSuccess, toast]);

  // When listening stops, process the final transcript
  useEffect(() => {
    if (!isListening && transcript && orbState === "listening") {
      processCommand(transcript);
    }
  }, [isListening, transcript, orbState, processCommand]);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranscript("");
      try {
        recognitionRef.current?.start();
      } catch (e) {
        // Handle case where it might already be started
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border border-border">
      <div className="flex-1 relative flex items-center justify-center p-4">
        <div className="absolute inset-0 z-0">
          <OrbCanvas state={orbState} className="w-full h-full opacity-60" />
        </div>
        <div className="z-10 w-full max-w-sm">
          <ScrollArea className="h-48 w-full rounded bg-background/50 border border-border/50 backdrop-blur-sm p-4">
            {chatLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                <TerminalIcon className="w-8 h-8 mb-2" />
                <p className="font-mono text-xs uppercase tracking-widest text-center">System awaiting voice input...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {chatLog.map((log, i) => (
                  <div key={i} className={`flex ${log.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 text-sm font-mono ${
                      log.role === 'user' 
                        ? 'bg-primary/20 text-primary border border-primary/30' 
                        : 'bg-secondary text-secondary-foreground border border-border'
                    }`}>
                      <span className="text-[10px] opacity-50 block mb-1 uppercase">
                        {log.role === 'user' ? 'OPERATOR' : 'CARVIS'}
                      </span>
                      {log.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {transcript && (
              <div className="mt-4 flex justify-end">
                <div className="max-w-[85%] px-3 py-2 text-sm font-mono bg-primary/10 text-primary border border-primary/30 border-dashed animate-pulse">
                  {transcript}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
      
      <div className="p-4 border-t border-border flex justify-between items-center bg-background z-10">
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          STATUS: <span className={orbState !== 'idle' ? "text-primary animate-pulse" : ""}>{orbState.toUpperCase()}</span>
        </div>
        
        <Button 
          onClick={toggleListen}
          size="lg"
          className={`rounded-none font-mono uppercase tracking-widest border transition-all ${
            isListening 
              ? 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90 shadow-[0_0_15px_rgba(255,68,68,0.5)]' 
              : 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
          }`}
        >
          {isListening ? (
            <><MicOff className="w-4 h-4 mr-2" /> TERMINATE INPUT</>
          ) : (
            <><Mic className="w-4 h-4 mr-2" /> INITIALIZE MIC</>
          )}
        </Button>
      </div>
    </div>
  );
}