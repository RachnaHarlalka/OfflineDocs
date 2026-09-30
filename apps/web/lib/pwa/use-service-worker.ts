"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestQueueFlush } from "@/lib/offline/request-flush";

/* Config travels as a query string: public/sw.js sits outside the Next build and
   so cannot read env vars itself. */
const SW_URL = `/sw.js?${new URLSearchParams({
  v: process.env.NEXT_PUBLIC_SW_VERSION ?? "dev",
  api: process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3000",
})}`;

export interface ServiceWorkerState {
  /** A new version is installed and waiting for the user to accept it. */
  updateReady: boolean;
  applyUpdate: () => void;
}

/**
 * Owns the worker's registration and the update-banner state. Never activates a
 * waiting worker on its own — that would swap the code out from under someone
 * mid-edit. Only applyUpdate, behind the banner's button, may do that.
 */
export function useServiceWorker(): ServiceWorkerState {
  const [updateReady, setUpdateReady] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;

    /* The client message queue starts disabled and is only enabled by assigning
       `onmessage` or calling this. Every listener here uses addEventListener, so
       without it the worker's queue notices sit buffered and never arrive. */
    navigator.serviceWorker.startMessages();

    function watchForUpdate(registration: ServiceWorkerRegistration) {
      /* A worker already waiting when this page loaded is one there is no work in
         front of yet — nothing typed, nothing mid-save. Take it now instead of
         asking again.

         A plain browser reload does not replace the controlling worker: the new
         document is still controlled by the old one, so the waiting worker stays
         waiting and, without this, the banner came back on every refresh. That
         reads as a bug, and it teaches people that Refresh does nothing. The
         banner is for the update that arrives *while* someone is working, which
         is the case below — that one is still theirs to accept. */
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      function watchInstalling(installing: ServiceWorker) {
        installing.addEventListener("statechange", () => {
          /* No controller means a first install rather than an update — there is
             no running version to refresh out of. */
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      }

      // A worker already mid-install when register() resolved has already fired
      // its own `updatefound` — nothing below would ever hear it reach
      // "installed" without this, so the banner never appears for it.
      if (registration.installing) {
        watchInstalling(registration.installing);
      }

      registration.addEventListener("updatefound", () => {
        const { installing } = registration;
        if (!installing) return;
        watchInstalling(installing);
      });
    }

    // updateViaCache: "none" — otherwise a cached sw.js hides a new deploy for
    // the length of its max-age.
    void navigator.serviceWorker
      .register(SW_URL, { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (cancelled) return;
        registrationRef.current = registration;
        watchForUpdate(registration);
        // Anything queued while the app was closed goes now.
        void requestQueueFlush();
      })
      .catch((error) => console.warn("[pwa] could not register the worker", error));

    return () => {
      cancelled = true;
    };
  }, []);

  /* Reconnecting is the whole point of the queue. Background Sync (Part 3) also
     fires on its own where it exists; this covers the tab that is already open,
     and the browsers that have no Background Sync at all. */
  useEffect(() => {
    const onOnline = () => void requestQueueFlush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = registrationRef.current?.waiting;
    if (!waiting) return;

    /* Reload only once the new worker controls the page: reloading first would
       land back in the old one, which is still in control until it activates. */
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true },
    );
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, []);

  return { updateReady, applyUpdate };
}
