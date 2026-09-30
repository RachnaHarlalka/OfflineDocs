"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { DraftResponse, PresenceUser } from "@docsync/shared";
import { ApiError } from "@/lib/api/client";
import { fetchOwnDraft, fetchPresence, sendHeartbeat } from "@/lib/api/presence";

/** Mirrors the server's own constants in `config/env.ts` — keep the two in step. */
const HEARTBEAT_INTERVAL_MS = 25_000;
const POLL_INTERVAL_MS = 15_000;

export const presenceQueryKey = (docId: string) =>
  ["docs", "detail", docId, "presence"] as const;

/**
 * Polls "who else has this open". Refetching on a timer is the whole design — there
 * is no persistent transport to push this over (techspec 7), and a poll degrades
 * into simply going quiet when the network drops rather than needing reconnect logic.
 */
export function usePresence(
  docId: string,
  enabled: boolean,
): UseQueryResult<PresenceUser[]> {
  return useQuery({
    queryKey: presenceQueryKey(docId),
    queryFn: () => fetchPresence(docId),
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    // The list is a fact about *now*; a stale cached answer is worse than none.
    staleTime: 0,
    // Presence is decoration. A blip must not surface as an error state in the top
    // bar, and it must not retry-storm a server that is already struggling.
    retry: false,
  });
}

export const ownDraftQueryKey = (docId: string) =>
  ["docs", "detail", docId, "draft"] as const;

/**
 * The caller's own draft backup, read back once when the editor opens — the half
 * of techspec 4.1 that makes the backup a backup rather than write-only storage.
 * It is what is left when local IndexedDB is gone: storage cleared, a different
 * device, or a browser that evicted the origin.
 *
 * Read once per mount, never polled: the only writer of this row from here on is
 * this device's own heartbeat, so a later read could only hand back what the
 * editor already has. `staleTime: Infinity` is what holds that.
 */
export function useOwnDraft(
  docId: string,
  enabled: boolean,
): UseQueryResult<DraftResponse["draft"]> {
  return useQuery({
    queryKey: ownDraftQueryKey(docId),
    queryFn: () => fetchOwnDraft(docId),
    enabled,
    staleTime: Infinity,
    // A backup that cannot be read is not worth retry-storming for; the document
    // itself is unaffected either way.
    retry: false,
  });
}

export interface DraftBackupState {
  /** Set once the caller's access is provably gone, so the editor can say so plainly. */
  accessRevoked: boolean;
}

/**
 * The other half of the same request: a periodic, private backup of the caller's
 * unsaved draft (techspec 4.1).
 *
 * This is emphatically *not* autosave. It never merges into the canonical document
 * and never notifies anyone — it exists so a draft survives cleared local storage or
 * a device the user never returns to. Explicit Save remains the only thing that
 * publishes work, which is why the editor's badge is untouched by any of this.
 */
export function useDraftBackup(
  docId: string,
  options: {
    enabled: boolean;
    isDirty: boolean;
    canBackUp: boolean;
    encodeFullState: () => string;
  },
): DraftBackupState {
  const { enabled, isDirty, canBackUp, encodeFullState } = options;
  const [accessRevoked, setAccessRevoked] = useState(false);

  // A ref, not a dependency: `isDirty` and the encoder change on every keystroke,
  // and re-arming the interval that often would mean a heartbeat that never fires
  // on a fast typist. The interval stays mounted once and reads the latest values.
  const latest = useRef({ isDirty, canBackUp, encodeFullState });
  useEffect(() => {
    latest.current = { isDirty, canBackUp, encodeFullState };
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function beat() {
      const { isDirty: dirty, canBackUp: allowed, encodeFullState: encode } = latest.current;
      try {
        // Viewers and clean documents still beat — presence is the point, and a
        // reader who has the document open is exactly who the chips exist to show.
        await sendHeartbeat(docId, allowed && dirty ? { update: encode() } : {});
        if (!cancelled) setAccessRevoked(false);
      } catch (error) {
        // 404 covers "deleted" and "you were removed" alike — `requireRole` returns
        // the same code for both so a non-collaborator cannot probe for existence.
        // 403 is a real demotion. Either way the honest message is the same one.
        if (
          !cancelled &&
          error instanceof ApiError &&
          (error.status === 404 || error.status === 403)
        ) {
          setAccessRevoked(true);
        }
        // Anything else — offline, a 500, a timeout — is left alone on purpose. A
        // backup is best-effort by definition, and telling the user their access is
        // gone because the wifi dropped would be worse than saying nothing.
      }
    }

    void beat();
    const id = setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [docId, enabled]);

  return { accessRevoked };
}
