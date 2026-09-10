"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const KEY = "gv-puja:activity-last-seen";

// No real change events to subscribe to — the "recheck" trigger is a route
// change (BottomNav re-renders and re-calls getSnapshot on every navigation,
// see useActivityUnread below), not a live storage event.
function subscribe() {
  return () => {};
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Compares the latest activity_log timestamp against what this device last
 * saw (localStorage, so it's per-viewer and never touches the server) to
 * decide whether the Activity nav tab should show an unread dot. BottomNav
 * is a persistent layout component that never remounts on navigation, so
 * reading pathname here just forces a fresh getSnapshot() call on every
 * route change — visiting /activity marks it seen, and the next navigation
 * anywhere picks that up and clears the dot.
 */
export function useActivityUnread(latestActivityAt: string | null): boolean {
  usePathname();
  const lastSeen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!latestActivityAt) return false;
  return !lastSeen || lastSeen < latestActivityAt;
}

export function markActivitySeen(latestActivityAt: string | null) {
  if (!latestActivityAt) return;
  try {
    localStorage.setItem(KEY, latestActivityAt);
  } catch {
    // Ignore — worst case the badge reappears next time.
  }
}
