// Shared render/fixture helpers for doc-editor.*.test.tsx. Not a test file
// itself (no *.test.tsx suffix), so vitest's include pattern never picks it
// up as a suite — it exists purely to keep the actual specs free of
// boilerplate that would otherwise be copy-pasted across four files.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import * as Y from "yjs";
import type { DocDetail } from "@docsync/shared";
import { DOC_QUERY_KEY } from "@/lib/documents/use-documents";
import { DocEditor } from "@/components/documents/doc-editor";
import { base64ToBytes, bytesToBase64 } from "@/lib/documents/base64";

/** Matches the private BODY_FIELD constant in use-yjs-doc.ts. */
const BODY_FIELD = "body";

let docCounter = 0;

export function makeDoc(overrides: Partial<DocDetail> = {}): DocDetail {
  docCounter += 1;
  return {
    id: `doc-${docCounter}-${Date.now()}`,
    title: "Untitled document",
    ownerId: "owner-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    snapshot: null,
    role: "owner",
    ...overrides,
  };
}

/** Encodes `text` as a real Yjs update, base64'd exactly the way the server
 *  would hand it back as `snapshot` — so useYjsDoc's real Y.applyUpdate path
 *  is exercised, not a stand-in. Keep to plain ASCII (no bytes >= 0x80): see
 *  the Observations note about bytesToBase64's 0x7f mask. */
export function makeSnapshot(text: string): string {
  const doc = new Y.Doc();
  doc.getText(BODY_FIELD).insert(0, text);
  return bytesToBase64(Y.encodeStateAsUpdate(doc));
}

/** Inverse of the payload useYjsDoc's encodeUpdate() sends to Save — decodes
 *  a captured save-call argument back to the body text it represents, so
 *  tests can assert on content instead of opaque base64. */
export function decodeBodyFromUpdate(update: string): string {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, base64ToBytes(update));
  return doc.getText(BODY_FIELD).toString();
}

export function renderDocEditor(doc: DocDetail) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(DOC_QUERY_KEY(doc.id), doc);

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <DocEditor id={doc.id} />
    </QueryClientProvider>,
  );

  return { ...utils, queryClient, doc };
}

export function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
