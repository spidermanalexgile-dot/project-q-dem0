import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { dayTripperPersona, type DayTripperVibe } from "../data/dayTripper";

export type DayTripperSpend = {
  id: string;
  spotId: string | null;
  vendor: string;
  amount: number;
  at: number;
};

type Ctx = {
  qcashStart: number;
  qcashBalance: number;
  spends: DayTripperSpend[];
  vibe: DayTripperVibe | null;
  selectedSpotId: string | null;
  setVibe: (v: DayTripperVibe | null) => void;
  setSelectedSpotId: (id: string | null) => void;
  recordSpend: (s: Omit<DayTripperSpend, "id" | "at">) => void;
};

const DayCtx = createContext<Ctx | null>(null);

export function DayTripperProvider({ children }: { children: ReactNode }) {
  const [qcashBalance, setBalance] = useState<number>(dayTripperPersona.qcashGranted);
  const [spends, setSpends] = useState<DayTripperSpend[]>([]);
  const [vibe, setVibe] = useState<DayTripperVibe | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);

  const recordSpend = useCallback(
    (s: Omit<DayTripperSpend, "id" | "at">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const entry: DayTripperSpend = { ...s, id, at: Date.now() };
      setSpends((prev) => [...prev, entry]);
      setBalance((prev) => Math.max(0, prev - s.amount));
    },
    [],
  );

  const value = useMemo<Ctx>(
    () => ({
      qcashStart: dayTripperPersona.qcashGranted,
      qcashBalance,
      spends,
      vibe,
      selectedSpotId,
      setVibe,
      setSelectedSpotId,
      recordSpend,
    }),
    [qcashBalance, spends, vibe, selectedSpotId, recordSpend],
  );

  return <DayCtx.Provider value={value}>{children}</DayCtx.Provider>;
}

export function useDayTripper() {
  const ctx = useContext(DayCtx);
  if (!ctx) throw new Error("useDayTripper must be inside DayTripperProvider");
  return ctx;
}
