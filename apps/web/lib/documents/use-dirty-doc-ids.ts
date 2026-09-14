"use client";

import { useSyncExternalStore } from "react";
import {
  getDirtyDocIdsServerSnapshot,
  getDirtyDocIdsSnapshot,
  subscribeDirtyDocIds,
} from "@/lib/documents/dirty-docs";

/**
 * Cross-tab only: the `storage` event fires in every *other* tab sharing this
 * origin, never the tab that made the write — same-tab dashboard/editor can't
 * coexist anyway, since navigating to a doc unmounts the dashboard.
 *
 * `useSyncExternalStore`, not `useState` + an effect: the server can't read
 * localStorage at all, so a lazy `useState(() => ...)` initializer would read
 * the *client's* value on hydration while the server rendered the empty-set
 * default — a guaranteed hydration mismatch for any visitor with an existing
 * dirty doc. The explicit server snapshot here avoids that the same way
 * `ThemeToggle` avoids guessing the stored theme before mount.
 */
export function useDirtyDocIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribeDirtyDocIds,
    getDirtyDocIdsSnapshot,
    getDirtyDocIdsServerSnapshot,
  );
}
