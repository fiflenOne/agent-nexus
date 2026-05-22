import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export interface RLI {
  stability: number;
  tuning_speed: number;
  conflict_dissolution: number;
  non_repetition: number;
  creative_continuity: number;
}

interface MonadContextValue {
  rli: RLI;
  setRli: (rli: Partial<RLI>) => void;
  isResonating: boolean;
  triggerResonance: (durationMs?: number) => void;
}

const DEFAULT_RLI: RLI = {
  stability: 0.5,
  tuning_speed: 0.5,
  conflict_dissolution: 0.5,
  non_repetition: 0.5,
  creative_continuity: 0.5,
};

const MonadCtx = createContext<MonadContextValue | null>(null);

export function MonadProvider({ children }: { children: ReactNode }) {
  const [rli, setRliState] = useState<RLI>(DEFAULT_RLI);
  const [isResonating, setIsResonating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setRli = useCallback((next: Partial<RLI>) => {
    setRliState((prev) => ({ ...prev, ...next }));
  }, []);

  const triggerResonance = useCallback((durationMs = 2400) => {
    setIsResonating(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsResonating(false), durationMs);
  }, []);

  const value = useMemo(
    () => ({ rli, setRli, isResonating, triggerResonance }),
    [rli, setRli, isResonating, triggerResonance],
  );

  return <MonadCtx.Provider value={value}>{children}</MonadCtx.Provider>;
}

export function useMonad(): MonadContextValue {
  const ctx = useContext(MonadCtx);
  if (!ctx) throw new Error("useMonad must be used within <MonadProvider>");
  return ctx;
}
