"use client";

import { useEffect, useRef, useState } from "react";
import type { DocDetail } from "@docsync/shared";
import { Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncBadge } from "@/components/documents/sync-badge";
import { PresenceChips } from "@/components/documents/presence-chips";
import { DocSavedNotice } from "@/components/documents/doc-saved-notice";
import { DraftRestoreNotice } from "@/components/documents/draft-restore-notice";
import { DictationControl } from "@/components/documents/dictation-panel";
import { SharePanel } from "@/components/documents/share-panel";
import { EDITOR_LABELS, PRESENCE_LABELS, QUEUE_LABELS } from "@/constants/labels";
import { QUEUE_REFUSAL_MESSAGES } from "@/constants/errors";
import { ApiError, csrfToken } from "@/lib/api/client";
import { useDoc, useRenameDoc, useSaveDoc } from "@/lib/documents/use-documents";
import { useYjsDoc } from "@/lib/documents/use-yjs-doc";
import { useDraftBackup, useOwnDraft, usePresence } from "@/lib/documents/use-presence";
import { useSession } from "@/lib/auth/use-session";
import type { SyncState } from "@/lib/documents/sync-state";
import { insertText, type TextSelection } from "@/lib/dictation/insert-text";
import { requestQueueFlush } from "@/lib/offline/request-flush";
import { enqueueSave, type EnqueueRefusal } from "@/lib/offline/save-queue";
import { useDocQueueState, useQueueTotals } from "@/lib/offline/use-save-queue";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { RejectedSaveNotice } from "@/components/documents/rejected-save-notice";

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

/**
 * Shown when the heartbeat proves the caller's access is gone — the document was
 * deleted, or they were removed from it.
 *
 * The local draft is deliberately left intact and the text is offered for copying
 * rather than discarded. Someone else revoking a permission must not silently
 * destroy work this person has not saved; that is precisely the trust failure the
 * offline-first model exists to prevent.
 */
function AccessRevokedBanner({ body }: { body: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      role="alert"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-destructive/20 bg-destructive-soft px-4 py-2 text-caption text-destructive sm:px-8"
    >
      <span className="font-medium">{PRESENCE_LABELS.accessRevokedTitle}</span>
      <span className="min-w-0 flex-1">{PRESENCE_LABELS.accessRevokedHint}</span>
      <button
        type="button"
        className="underline"
        onClick={() => {
          void navigator.clipboard?.writeText(body).then(
            () => setCopied(true),
            () => undefined,
          );
        }}
      >
        {copied ? PRESENCE_LABELS.copied : PRESENCE_LABELS.copyText}
      </button>
    </div>
  );
}

function DocEditorLoaded({ doc }: { doc: DocDetail }) {
  const isViewer = doc.role === "viewer";
  const isOwner = doc.role === "owner";
  const [shareOpen, setShareOpen] = useState(false);
  // The same cached query the parent read, for its refetch(): a flushed queued
  // save is the one moment this page needs the server's current snapshot.
  const { refetch: refetchDoc } = useDoc(doc.id);
  const online = useOnlineStatus();
  const {
    body,
    setBody,
    isDirty,
    encodeUpdate,
    markSaved,
    encodeFullState,
    reconcileWithServer,
    hasContentBeyond,
    restoreDraft,
  } = useYjsDoc(
    doc.id,
    doc.snapshot,
  );
  const saveDoc = useSaveDoc(doc.id);
  const renameDoc = useRenameDoc();
  const { data: me } = useSession();

  /* The backup this account last left on the server, read once (techspec 4.1).
     Viewers never have one — the heartbeat refuses their updates — so they are
     not asked for it. */
  const ownDraft = useOwnDraft(doc.id, online && !isViewer);

  // Presence and the draft backup are one request on the wire (techspec 4.1/7),
  // but two hooks here: one writes on a timer, the other reads on a timer, and
  // only the write half has anything to say when access disappears.
  const { accessRevoked } = useDraftBackup(doc.id, {
    // No point heartbeating into a void — offline, the request cannot land, and a
    // failed beat must not be mistaken for revoked access.
    enabled: online,
    isDirty,
    /* Not until the backup has been read back. The first heartbeat fires on
       mount, and backing up *this* device's state before reading the old one
       would overwrite the very draft the user is about to be offered. Presence
       still beats meanwhile; only the update half waits. */
    canBackUp: !isViewer && !ownDraft.isPending,
    encodeFullState,
  });

  /* Evaluated once, when the backup arrives, rather than on every render: typing
     afterwards does not make an older backup less restorable, and decoding it per
     keystroke would be real work for no answer that changes. */
  const hasContentBeyondRef = useRef(hasContentBeyond);
  useEffect(() => {
    hasContentBeyondRef.current = hasContentBeyond;
  });

  const [restorableDraft, setRestorableDraft] = useState<string | null>(null);
  useEffect(() => {
    const backup = ownDraft.data;
    if (!backup) return;
    // A backup this document already contains is not a recovery, just noise.
    setRestorableDraft(hasContentBeyondRef.current(backup.update) ? backup.update : null);
  }, [ownDraft.data]);

  const { data: present } = usePresence(doc.id, online && !accessRevoked);

  // The list is a plain fact about the document, so the caller is filtered here
  // rather than server-side — "who else" is a question only this screen asks.
  const others = (present ?? []).filter((person) => person.userId !== me?.id);

  const [title, setTitle] = useState(doc.title);
  const [queueRefusal, setQueueRefusal] = useState<EnqueueRefusal | null>(null);
  const { pending: pendingCount, rejected: rejectedCount } = useDocQueueState(doc.id);
  const totals = useQueueTotals();

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

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // The last cursor the user left in the body. Dictation inserts here, even
  // though focus has moved into the panel by the time it does.
  const selectionRef = useRef<TextSelection | null>(null);
  const pendingCaretRef = useRef<number | null>(null);

  function rememberSelection(textarea: HTMLTextAreaElement) {
    selectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
  }

  // Dictation text goes through setBody like a keystroke, so it becomes an
  // ordinary Yjs edit that follows the normal draft -> Save path.
  function insertDictation(text: string) {
    const result = insertText(body, selectionRef.current, text);
    setBody(result.body);
    selectionRef.current = { start: result.caret, end: result.caret };
    pendingCaretRef.current = result.caret;
  }

  // Put the caret after the inserted text once the new body has rendered.
  useEffect(() => {
    const caret = pendingCaretRef.current;
    const textarea = bodyRef.current;
    if (caret === null || !textarea) return;
    pendingCaretRef.current = null;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  }, [body]);

  /* Offline, Save queues rather than refusing (Phase 2 supersedes Part 1's
     disabled button). markSaved() only on a durable enqueue: the queued entry is
     what the next delta is measured from, so losing it would lose the edit. */
  async function queueSave(update: string) {
    const result = await enqueueSave({ docId: doc.id, update, csrf: csrfToken() });

    setQueueRefusal(result.ok ? null : result.reason);
    if (!result.ok) return;

    markSaved();
    // Clears a failed attempt that this enqueue has now taken responsibility for,
    // so the badge reads Pending rather than staying on Save failed.
    saveDoc.reset();

    /* Registers the Background Sync now rather than on reconnect: it is what
       sends this change if the tab is closed before the network returns. */
    void requestQueueFlush();
  }

  function handleSave() {
    if (isViewer || !isDirty || saveDoc.isPending) return;

    const update = encodeUpdate();
    if (!online) {
      void queueSave(update);
      return;
    }

    saveDoc.mutate(update, {
      onSuccess: () => markSaved(),
      /* navigator.onLine reports true on a dead network, so reachability is only
         really known once a request has failed. Anything the server answered is
         a real error and stays one; a transport failure is queued instead. */
      onError: (error) => {
        if (!(error instanceof ApiError)) void queueSave(update);
      },
    });
  }

  /* The service worker sends queued saves, including after this page was
     reloaded or while it sat untouched — so without this the badge would sit on
     "Draft" over work the server already has, and pressing Save would push
     "updated this document" to every collaborator for nothing. The refetch is
     what supplies the server's own snapshot to re-base on; the worker drops its
     cached copy first, so this reads the fresh one. */
  const reconcileRef = useRef(reconcileWithServer);
  useEffect(() => {
    reconcileRef.current = reconcileWithServer;
  });

  useEffect(() => {
    const worker = navigator.serviceWorker;
    if (!worker) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; docId?: string } | null;
      if (data?.type !== "SAVE_FLUSHED" || data.docId !== doc.id) return;

      void refetchDoc().then((result) => {
        const snapshot = result.data?.snapshot;
        if (snapshot) reconcileRef.current(snapshot);
      });
    };

    worker.addEventListener("message", onMessage);
    return () => worker.removeEventListener("message", onMessage);
  }, [doc.id, refetchDoc]);

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

  /* A prior failure outranks being offline: "Save failed" is the more actionable
     of the two, and losing it on a disconnect would hide that the last attempt
     did not land. Queued work outranks "Offline" for the same reason — it says
     the change is held safely, not merely that the network is gone. */
  const syncState: SyncState = saveDoc.isPending
    ? "saving"
    : // Refused work is unsaved work: "Saved" here would be untrue.
      saveDoc.isError || rejectedCount > 0
      ? "error"
      : pendingCount > 0
        ? online
          ? "reconnecting"
          : "pending"
        : !online
          ? "offline"
          : isDirty
            ? "draft"
            : "saved";

  const canSave = !isViewer && isDirty && !saveDoc.isPending;

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

        <PresenceChips people={others} />

        <SyncBadge state={syncState} />

        {pendingCount > 0 ? (
          <span className="text-caption text-muted-foreground max-sm:hidden">
            {pendingCount === 1 ? QUEUE_LABELS.pendingOne : QUEUE_LABELS.pendingMany(pendingCount)}
          </span>
        ) : null}

        {isViewer ? null : (
          <DictationControl docId={doc.id} online={online} onInsert={insertDictation} />
        )}

        {/* Owner-only, removed rather than disabled for everyone else (design 5b). */}
        {isOwner ? (
          <Button
            variant="outline"
            aria-label={EDITOR_LABELS.share}
            onClick={() => setShareOpen(true)}
          >
            <Share2 data-icon="inline-start" />
            <span className="max-md:hidden">{EDITOR_LABELS.share}</span>
          </Button>
        ) : null}

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

      <DocSavedNotice docId={doc.id} />

      {accessRevoked ? <AccessRevokedBanner body={body} /> : null}

      {restorableDraft && ownDraft.data ? (
        <DraftRestoreNotice
          backedUpAt={ownDraft.data.backedUpAt}
          onRestore={() => {
            restoreDraft(restorableDraft);
            setRestorableDraft(null);
          }}
          onDismiss={() => setRestorableDraft(null)}
        />
      ) : null}

      {!isViewer && !online ? (
        <p className="shrink-0 border-b border-warning/25 bg-warning-soft px-4 py-2 text-caption text-warning sm:px-8">
          {EDITOR_LABELS.offlineHint}
        </p>
      ) : null}

      {rejectedCount > 0 ? <RejectedSaveNotice docId={doc.id} body={body} /> : null}

      {queueRefusal ? (
        <p
          role="alert"
          className="shrink-0 border-b border-destructive/20 bg-destructive-soft px-4 py-2 text-caption text-destructive sm:px-8"
        >
          {QUEUE_REFUSAL_MESSAGES[queueRefusal]}
        </p>
      ) : null}

      {/* The browser is the threat here, not the server: past seven days it may
          delete the queue itself, so this one names the document and the date. */}
      {totals.stale && totals.oldestQueuedAt !== null && pendingCount > 0 ? (
        <p
          role="alert"
          className="shrink-0 border-b border-destructive/20 bg-destructive-soft px-4 py-2 text-caption text-destructive sm:px-8"
        >
          <span className="font-medium">{QUEUE_LABELS.staleTitle}</span>{" "}
          {QUEUE_LABELS.staleBody(
            doc.title,
            new Date(totals.oldestQueuedAt).toLocaleDateString(),
          )}
        </p>
      ) : totals.nearBudget ? (
        <p className="shrink-0 border-b border-warning/25 bg-warning-soft px-4 py-2 text-caption text-warning sm:px-8">
          {QUEUE_LABELS.nearBudget}
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
        ref={bodyRef}
        value={body}
        readOnly={isViewer}
        onChange={(event) => setBody(event.target.value)}
        onSelect={(event) => rememberSelection(event.currentTarget)}
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

      {shareOpen ? (
        <SharePanel doc={doc} currentUserId={me?.id} onClose={() => setShareOpen(false)} />
      ) : null}
    </div>
  );
}
