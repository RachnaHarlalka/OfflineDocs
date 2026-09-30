
export const BRAND = {
  name: "DocSync",
  monogram: "D",
} as const;

export const LOGIN_PITCH = {
  headline: "Write together, online or offline.",
  body:
    "DocSync keeps every document editable while you are offline and merges your changes " +
    "the moment you reconnect. One shared workspace, with live presence on each document " +
    "and roles for everyone you share it with.",
  bodyShort:
    "DocSync keeps every document editable while you are offline and merges your changes " +
    "the moment you reconnect. One shared workspace, with live presence and roles.",
  features: ["Offline editing", "Live presence", "Roles & sharing"],
} as const;

export const LOGIN_FORM = {
  startPrefix: "Start",
  typedWords: ["writing", "drafting", "editing", "syncing"],
  headline: "Welcome back to your desk",
  body:
    "Wherever you left off — a train, a flight, a dead zone — the edits you made there " +
    "are waiting to sync.",
  googleCta: "Continue with Google",
  googleCtaBusy: "Redirecting to Google…",
  workspaceNote: "Your workspace is created the first time you sign in.",
  legalPrefix: "By continuing you agree to the",
  legalTerms: "Terms",
  legalAnd: "and",
  legalPrivacy: "Privacy Policy",
  legalSuffix: ".",
} as const;

/** The static preview beside the form. Illustrative content, not live data. */
export const WORKSPACE_PREVIEW = {
  title: "Workspace preview",
  documents: [
    {
      id: "project-requirements",
      name: "Project Requirements",
      meta: "Edited 2 min ago · Maya, Dev",
      status: "synced",
      highlighted: true,
    },
    {
      id: "sprint-14-notes",
      name: "Sprint 14 Notes",
      meta: "Edited offline · 3 changes queued",
      status: "pending",
      highlighted: false,
    },
    {
      id: "design-handoff",
      name: "Design Handoff",
      meta: "Edited yesterday · 5 collaborators",
      status: "synced",
      highlighted: false,
    },
  ],
} as const;

export const DOC_STATUS_LABELS = {
  synced: "Synced",
  pending: "Pending",
} as const;

export const SESSION_LABELS = {
  checking: "Checking your session…",
  redirecting: "Taking you to sign in…",
  finishingSignIn: "Finishing sign-in…",
  signOut: "Sign out",
  signingOut: "Signing out…",
  retry: "Try again",
  unreachableTitle: "Could not reach the server",
} as const;

export const APP_SHELL_LABELS = {
  searchPlaceholder: "Search documents",
  newDocument: "New document",
  creatingDocument: "Creating…",
  allDocuments: "All documents",
  sharedWithMe: "Shared with me",
  recent: "Recent",
  account: "Account",
  profile: "Profile",
  settings: "Settings",
  offlineTitle: "Offline ready",
  offlineBody: "Documents you open are kept on this device.",
  openNavigation: "Open navigation",
  closeNavigation: "Close navigation",
  theme: "Theme",
  notifications: "Notifications",
} as const;

export const DOCUMENTS_PAGE_LABELS = {
  title: "All documents",
  columnName: "Name",
  columnUpdated: "Last modified",
  columnAccess: "Access",
  columnStatus: "Status",
  errorTitle: "Could not load your documents",
  retry: "Try again",
  emptyTitle: "Create your first document",
  emptyBody:
    "Write, edit offline, and save when you're ready. Share it with your team as an editor or viewer at any time.",
} as const;

export const DOCUMENT_ROW_LABELS = {
  /** Saves queued on this device, shown under the row's badge. */
  pendingChanges: (count: number) => (count === 1 ? "1 change queued" : `${count} changes queued`),
  rowActions: "Document actions",
  viewDetails: "Details",
  rename: "Rename",
  renamePlaceholder: "Document title",
  share: "Share",
  duplicate: "Duplicate",
  duplicating: "Duplicating…",
  leave: "Leave",
  leaving: "Leaving…",
  confirmLeave: "Leave this document?",
  leaveDescription: "You'll lose access to this document. You can be re-invited later.",
  delete: "Delete",
  deleting: "Deleting…",
  confirmDelete: "Delete this document?",
  deleteDescription: "Deleting a document removes it for every collaborator. This cannot be undone.",
  cancel: "Cancel",
} as const;
// renameSave / renameCancel and DOC_DRAWER_LABELS.close were part of an
// earlier iteration (an explicit Save/Cancel pair, a custom "Close" text
// button) superseded by inline Enter/Escape rename and DialogContent's own
// close-X — removed rather than left unreferenced.

export const DOC_DRAWER_LABELS = {
  documentSection: "Document",
  owner: "Owner",
  yourRole: "Your role",
  status: "Status",
  members: "Members",
  created: "Created",
  updated: "Last modified",
  open: "Open",
  manageAccess: "Manage access",
} as const;

export const SHARE_PANEL_LABELS = {
  title: "Share document",
  invitePeople: "Invite people",
  emailPlaceholder: "name@company.com",
  sendInvite: "Send invite",
  sendInviteShort: "Invite",
  sending: "Sending…",
  done: "Done",
  roleHint: "Editors can write and save. Viewers can only read.",
  peopleWithAccess: "People with access",
  you: "(you)",
  /** A member with no Google display name, shown to a non-owner who can't see emails. */
  unnamedCollaborator: "Unnamed collaborator",
  removeAccess: "Remove access",
  confirmRemoveTitle: "Remove access?",
  removeDescriptionSuffix: "will lose access to this document. This can't be undone.",
  removing: "Removing…",
  cancel: "Cancel",
  inviteErrorFallback: "Something went wrong sending that invite.",
} as const;

export const EDITOR_LABELS = {
  titlePlaceholder: "Untitled document",
  bodyPlaceholder: "Start writing…",
  save: "Save",
  saving: "Saving…",
  saveFailed: "Couldn't save. Try again.",
  retry: "Retry",
  viewOnly: "View only",
  offlineHint: "You're offline — saves are kept on this device and sync when you reconnect.",
  loadErrorTitle: "Couldn't load this document",
} as const;

export const PRESENCE_LABELS = {
  someone: "Someone",
  hasThisOpen: "has this open",
  haveThisOpen: "have this open",
  accessRevokedTitle: "You no longer have access to this document.",
  accessRevokedHint:
    "Your unsaved changes are still on this device. Copy them out before you leave.",
  copyText: "Copy text",
  copied: "Copied",
} as const;

/**
 * The offer to restore a server-side draft backup. Worded as a question the user
 * answers, never as something that has already happened — nothing is put into the
 * document until they press Restore.
 */
export const DRAFT_RESTORE_LABELS = {
  title: "Unsaved draft found",
  /** Followed by when it was backed up, e.g. "…from this document on 14 Sep 2026." */
  bodyPrefix: "You have unsaved writing backed up from",
  restore: "Restore draft",
  dismiss: "Not now",
} as const;

export const DICTATION_LABELS = {
  open: "Dictate",
  title: "Dictation",
  subtitle: "Nothing is added to the document until you insert it.",
  startRecording: "Start recording",
  stopRecording: "Stop recording",
  requestingMic: "Waiting for microphone…",
  recording: "Recording",
  /** Followed by the remaining time, e.g. "0:42 left". */
  timeLeftSuffix: "left",
  idleHint: "Record up to a minute at a time. Each recording is added to the transcript below.",
  inputLevel: "Microphone input level",
  transcribing: "Transcribing…",
  transcriptLabel: "Transcript",
  transcriptPlaceholder: "Your transcript appears here. Edit it before inserting.",
  offlineHint:
    "You're offline — recordings are kept on this device and transcribed when you reconnect.",
  /** Phase 4.2: the placeholder that stands in for a transcript until there is a network. */
  queuedOne: "1 recording queued — it will transcribe when you're back online",
  queuedMany: (count: number) =>
    `${count} recordings queued — they will transcribe when you're back online`,
  retry: "Retry",
  discard: "Discard",
  clear: "Clear",
  copy: "Copy",
  copied: "Copied",
  insert: "Insert at cursor",
} as const;

export const PUSH_LABELS = {
  enable: "Enable notifications",
  disable: "Turn off notifications",
  enabling: "Enabling…",
  blocked: "Notifications are blocked in your browser settings.",
  unsupported: "This browser can't show notifications.",
  failed: "Couldn't enable notifications. Try again.",
  /** Shown in-app instead of an OS notification when the doc is already open. */
  savedSuffix: "updated this document.",
  reload: "Reload",
  dismiss: "Dismiss",
} as const;

export const PWA_LABELS = {
  updateTitle: "Update available",
  updateBody: "A new version of DocSync is ready.",
  updateAction: "Refresh",
  updateDismiss: "Not now",
} as const;

export const OFFLINE_PAGE_LABELS = {
  title: "This page isn't available offline",
  body: "Documents you've already opened are saved on this device. Reconnect to open this one.",
  retry: "Try again",
  backToDocuments: "Back to documents",
} as const;

export const SYNC_STATE_LABELS = {
  draft: "Draft",
  saving: "Saving…",
  saved: "Saved",
  pending: "Pending",
  reconnecting: "Reconnecting…",
  offline: "Offline",
  error: "Save failed",
} as const;

/** Saves waiting to reach the server. Count is rendered beside the badge. */
export const QUEUE_LABELS = {
  pendingOne: "1 change waiting to sync",
  pendingMany: (count: number) => `${count} changes waiting to sync`,
  queueFailed: "Couldn't queue that change on this device.",

  /* Why an enqueue was refused. Nothing queued is ever dropped to make room, so
     these all refuse the *new* change and say what to do about it (§16.2). */
  itemTooLarge: "That change is too large to queue on this device. Reconnect to save it.",
  queueFull:
    "This device is holding as many offline changes as it can. Reconnect to sync them before making more.",
  quotaExceeded:
    "This device has run out of storage. Reconnect to sync your changes, or free up space.",

  /** 80% of the budget — said once, calmly, before anything is refused. */
  nearBudget: "This device is nearly full of unsynced changes. Reconnect soon to sync them.",
  /** Past 7 days the browser itself may delete the queue, so this one is loud. */
  staleTitle: "Unsynced changes are at risk",
  staleBody: (docTitle: string, date: string) =>
    `"${docTitle}" has had unsynced changes since ${date}. Browsers can delete them after seven days offline — reconnect, or copy the text out.`,

  /* Access was revoked while a change waited. The work is kept and the wording
     says so — §16.2 forbids the app discarding it. */
  rejectedTitle: "You no longer have access to this document.",
  rejectedBody: "Your unsaved changes are kept on this device.",
  copyText: "Copy text",
  copied: "Copied",
  discard: "Discard changes",
  confirmDiscardTitle: "Discard these changes?",
  confirmDiscardDescription:
    "This permanently deletes the changes that couldn't be saved. Copy the text first — this can't be undone.",
  confirmDiscardCancel: "Keep them",
  confirmDiscardAction: "Discard",
} as const;
