import { Navigate } from "react-router-dom";
import { useDestination } from "../../context/DestinationContext";
import type { ReactNode } from "react";

/**
 * Day Tripper mode is Venice-only. If destination is Queenstown, redirect to /.
 */
export function DayGuard({ children }: { children: ReactNode }) {
  const { destination } = useDestination();
  if (destination === "queenstown") return <Navigate to="/" replace />;
  return <>{children}</>;
}
