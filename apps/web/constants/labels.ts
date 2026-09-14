
export const BRAND = {
  name: "DocSync",
  monogram: "D",
} as const;

export const LOGIN_PITCH = {
  headline: "Write together, online or offline.",
  body:
    "DocSync keeps every document editable while you are offline and merges your changes " +
    "the moment you reconnect. One shared workspace, live presence on each document, and " +
    "a full version history behind every save.",
  bodyShort:
    "DocSync keeps every document editable while you are offline and merges your changes " +
    "the moment you reconnect. One shared workspace, live presence, and full version history.",
  features: ["Offline editing", "Live presence", "Version history"],
} as const;

export const LOGIN_FORM = {
  startPrefix: "Start",
  typedWords: ["writing", "drafting", "editing", "syncing"],
  needHelp: "Need help?",
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
  removeAccess: "Remove access",
  confirmRemoveTitle: "Remove access?",
  removeDescriptionSuffix: "will lose access to this document. This can't be undone.",
  removing: "Removing…",
  cancel: "Cancel",
  inviteErrorFallback: "Something went wrong sending that invite.",
} as const;

export const DOC_PAGE_LABELS = {
  placeholderTitle: "Document",
  placeholderBody:
    "The editor for this document isn't built yet — this route exists so navigation has somewhere to land.",
} as const;

export const SYNC_STATE_LABELS = {
  draft: "Draft",
  saving: "Saving…",
  saved: "Saved",
  offline: "Offline",
  error: "Save failed",
} as const;
