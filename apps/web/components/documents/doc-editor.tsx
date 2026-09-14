"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DocDetail } from "@docsync/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncBadge } from "@/components/documents/sync-badge";
import { EDITOR_LABELS } from "@/constants/labels";
import { useDoc, useRenameDoc, useSaveDoc } from "@/lib/documents/use-documents";
import { useYjsDoc } from "@/lib/documents/use-yjs-doc";
import type { SyncState } from "@/lib/documents/sync-state";

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

function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeToConnectivity, getOnlineSnapshot, getServerOnlineSnapshot);
}

export function DocEditor({ id }: { id: string }) {
  const { data: doc, isPending, isError, refetch } = useDoc(id);

  if (isPending) {
    return <div className="h-full animate-pulse bg-muted/40" aria-busy="true" />;
  }

  if (isError) {
    return (
      <div role="alert" className="space-y-3 px-4 py-16 text-center sm:px-8">
        <p className="text-ui font-medium">{EDITOR_LABELS.loadErrorTitle}</p>
        <Button onClick={() => void refetch()}>{EDITOR_LABELS.retry}</Button>
      </div>
    );
  }

  // Keyed on the doc id: navigating between documents should reset local
  // title/Yjs state via a fresh mount, not react to changed props in place.
  return <DocEditorLoaded key={doc.id} doc={doc} />;
}

function DocEditorLoaded({ doc }: { doc: DocDetail }) {
  const isViewer = doc.role === "viewer";
  const online = useOnlineStatus();
  const { body, setBody, isDirty, encodeUpdate, markSaved } = useYjsDoc(doc.id, doc.snapshot);
  const saveDoc = useSaveDoc(doc.id);
  const renameDoc = useRenameDoc();

  const [title, setTitle] = useState(doc.title);

  // Escape reverts and blurs, but `setTitle` is async while `blur()` fires
  // `onBlur` synchronously — so `commitTitle` would still close over the
  // edited title and rename to the value Escape just discarded. This flag
  // tells that one blur to do nothing.
  const revertingRef = useRef(false);

  function commitTitle() {
    if (revertingRef.current) {
      revertingRef.current = false;
      return;
    }
    const trimmed = title.trim();
    if (!trimmed || trimmed === doc.title) {
      setTitle(doc.title);
      return;
    }
    renameDoc.mutate({ id: doc.id, title: trimmed });
  }

  function handleSave() {
    if (isViewer || !online || !isDirty || saveDoc.isPending) return;
    saveDoc.mutate(encodeUpdate(), { onSuccess: () => markSaved() });
  }

  // A ref, not a `[handleSave]` dependency: `handleSave` closes over state
  // that changes on every keystroke, and re-subscribing the listener that
  // often is wasted work — the ref keeps the listener itself mounted once
  // while always calling through to the latest closure. Updated in an
  // effect, never during render, per the rules of React.
  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        handleSaveRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // A prior failure outranks being offline: "Save failed" is the more
  // actionable of the two, and losing it on a disconnect would hide that the
  // last attempt did not land.
  const syncState: SyncState = saveDoc.isPending
    ? "saving"
    : saveDoc.isError
      ? "error"
      : !online
        ? "offline"
        : isDirty
          ? "draft"
          : "saved";

  const canSave = !isViewer && online && isDirty && !saveDoc.isPending;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-8">
        <input
          value={title}
          disabled={isViewer}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              revertingRef.current = true;
              setTitle(doc.title);
              event.currentTarget.blur();
            }
          }}
          placeholder={EDITOR_LABELS.titlePlaceholder}
          className="min-w-0 flex-1 truncate bg-transparent text-page-title outline-none disabled:opacity-100"
        />

        <SyncBadge state={syncState} />

        {isViewer ? (
          <Badge variant="neutral" size="md">
            {EDITOR_LABELS.viewOnly}
          </Badge>
        ) : (
          <Button className="max-md:hidden" onClick={handleSave} disabled={!canSave}>
            {saveDoc.isPending ? EDITOR_LABELS.saving : EDITOR_LABELS.save}
          </Button>
        )}
      </div>

      {!isViewer && !online ? (
        <p className="shrink-0 border-b border-warning/25 bg-warning-soft px-4 py-2 text-caption text-warning sm:px-8">
          {EDITOR_LABELS.offlineHint}
        </p>
      ) : null}

      {saveDoc.isError ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-destructive/20 bg-destructive-soft px-4 py-2 text-caption text-destructive sm:px-8">
          {EDITOR_LABELS.saveFailed}
          <button type="button" className="underline" onClick={handleSave}>
            {EDITOR_LABELS.retry}
          </button>
        </div>
      ) : null}

      <textarea
        value={body}
        readOnly={isViewer}
        onChange={(event) => setBody(event.target.value)}
        placeholder={EDITOR_LABELS.bodyPlaceholder}
        className="flex-1 resize-none bg-transparent px-4 py-5 text-body text-foreground-2 outline-none sm:px-8"
      />

      {isViewer ? null : (
        <div className="shrink-0 border-t border-border bg-card px-3.5 py-3 md:hidden">
          <Button className="h-12 w-full" onClick={handleSave} disabled={!canSave}>
            {saveDoc.isPending ? EDITOR_LABELS.saving : EDITOR_LABELS.save}
          </Button>
        </div>
      )}
    </div>
  );
}
