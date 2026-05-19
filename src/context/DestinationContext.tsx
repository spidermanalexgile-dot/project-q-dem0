import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

export type Destination = "queenstown" | "venice";

type DestinationCtx = {
  destination: Destination;
  setDestination: (d: Destination) => void;
  toggle: () => void;
};

const Ctx = createContext<DestinationCtx>({
  destination: "queenstown",
  setDestination: () => {},
  toggle: () => {},
});

const STORAGE_KEY = "q-destination";

function readInitial(): Destination {
  if (typeof window === "undefined") return "queenstown";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "queenstown" || v === "venice") return v;
  } catch {
    /* ignore */
  }
  return "queenstown";
}

export function DestinationProvider({ children }: { children: ReactNode }) {
  const [destination, setDestinationState] = useState<Destination>(readInitial);

  // Cross-iframe + cross-tab sync via the storage event
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const v = e.newValue;
      if (v === "queenstown" || v === "venice") setDestinationState(v);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setDestination = useCallback((d: Destination) => {
    setDestinationState(d);
    try {
      localStorage.setItem(STORAGE_KEY, d);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setDestination(destination === "queenstown" ? "venice" : "queenstown");
  }, [destination, setDestination]);

  return (
    <Ctx.Provider value={{ destination, setDestination, toggle }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDestination() {
  return useContext(Ctx);
}
