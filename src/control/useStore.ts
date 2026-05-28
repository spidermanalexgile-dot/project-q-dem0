import { useSyncExternalStore } from "react";
import { getState, getStoreVersion, subscribe, type State } from "./state";

/**
 * React subscription to the single ProjectQ store via useSyncExternalStore.
 * The snapshot is a monotonic version counter (state is mutated in-place,
 * so the reference can't be used for snapshot comparison); the component
 * reads the live state directly after the version bump triggers a re-render.
 *
 * Components must NEVER mutate state directly — only via documented commands
 * (setLever / setDayType / setPhase / setRebate / loadPayload). The "one
 * source, many writers" rule is what makes the live agent integration work.
 */
export function useStore(): State | null {
  useSyncExternalStore(subscribe, getStoreVersion, getStoreVersion);
  return getState();
}
