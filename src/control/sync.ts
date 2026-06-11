/**
 * Cross-device sync for the lever console. Bridges the web dashboard and the
 * iPad control surface through a tiny shared endpoint (/api/sync): each client
 * PUSHes its control snapshot when the operator changes something, and POLLs for
 * changes pushed by the other device. A per-client id + a server revision
 * counter stop the two screens from echoing each other into a loop.
 *
 * The deterministic engine is untouched — this only moves lever VALUES around;
 * each device recomputes its own charts from them.
 */
import {
  subscribe,
  getStoreVersion,
  snapshotForSync,
  applySyncedState,
} from "./state";

const ENDPOINT = "/api/sync";
const POLL_MS = 1200;
const PUSH_DEBOUNCE_MS = 200;
const HEARTBEAT_MS = 6000;

function makeId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* fall through */
  }
  return "c" + Math.abs((performance.now() * 1000) | 0).toString(36) + (performance.now() | 0).toString(36);
}

let started = false;

export function startSync(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  const clientId = makeId();
  let lastPushedVersion = getStoreVersion();
  let lastRev = -1;
  let applying = false;
  let isOwner = false; // true when we made the last change → safe to re-assert
  let pushTimer: ReturnType<typeof setTimeout> | null = null;

  async function push() {
    const data = snapshotForSync();
    if (!data) return;
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, data }),
        keepalive: true,
      });
      const j = await r.json();
      if (typeof j?.rev === "number") lastRev = j.rev; // our push is now the latest
      isOwner = true; // we hold the current shared state
    } catch {
      /* offline / endpoint missing — stay local */
    }
  }

  function schedulePush() {
    if (applying) return; // don't re-broadcast a change we just received
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(push, PUSH_DEBOUNCE_MS);
  }

  async function poll() {
    try {
      const r = await fetch(ENDPOINT, { cache: "no-store" });
      const j = await r.json();
      if (
        j &&
        typeof j.rev === "number" &&
        j.rev > lastRev &&
        j.clientId !== clientId &&
        j.data
      ) {
        lastRev = j.rev;
        applying = true;
        applySyncedState(j.data);
        lastPushedVersion = getStoreVersion(); // adopt — don't echo it back
        applying = false;
        isOwner = false; // the other screen now holds the current state
      }
    } catch {
      /* ignore */
    }
  }

  // Push whenever the local model changes (debounced), unless we're mid-apply.
  subscribe(() => {
    const v = getStoreVersion();
    if (v !== lastPushedVersion && !applying) {
      lastPushedVersion = v;
      schedulePush();
    }
  });

  // Heartbeat: re-assert our snapshot every few seconds. If a serverless cold
  // start wiped the in-memory relay, this restores the shared state within one
  // beat (the server ignores an unchanged payload, so it's a silent no-op
  // otherwise). Skipped while we're applying a remote change.
  function heartbeat() {
    if (applying || !isOwner) return; // only the owner re-asserts (no clobber)
    void push();
  }

  // Adopt whatever the shared state already is, then keep polling + beating.
  void poll();
  setInterval(poll, POLL_MS);
  setInterval(heartbeat, HEARTBEAT_MS);
}
