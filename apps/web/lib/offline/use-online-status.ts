"use client";

import { useSyncExternalStore } from "react";

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

// Assume online during SSR/hydration's first pass — there's no real network
// signal on the server, and guessing "online" avoids flashing the offline
// banner for every visitor before the client snapshot corrects it.
function getServerOnlineSnapshot() {
  return true;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeToConnectivity, getOnlineSnapshot, getServerOnlineSnapshot);
}
