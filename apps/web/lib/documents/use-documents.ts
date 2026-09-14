"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { DocDetail, DocSummary } from "@docsync/shared";
import { ROUTES } from "@/constants/routes";
import {
  createDoc,
  deleteDoc,
  duplicateDoc,
  fetchDoc,
  fetchDocs,
  renameDoc,
  saveDoc,
} from "@/lib/api/documents";

// "list" segment matters: pairs with DOC_QUERY_KEY's "detail" segment below —
// a bare ["docs"] key would make this list's invalidation prefix-match and
// refetch the editor's snapshot query too, overwriting an unsaved local draft.
export const DOCS_QUERY_KEY = ["docs", "list"] as const;
export const DOC_QUERY_KEY = (id: string) => ["docs", "detail", id] as const;

export function useDocs(): UseQueryResult<DocSummary[]> {
  return useQuery({
    queryKey: DOCS_QUERY_KEY,
    queryFn: fetchDocs,
  });
}

export function useDoc(id: string): UseQueryResult<DocDetail> {
  return useQuery({
    queryKey: DOC_QUERY_KEY(id),
    queryFn: () => fetchDoc(id),
    // A background refetch (window focus, reconnect) would hand the editor a
    // new `snapshot` string, and useYjsDoc keys its Y.Doc off that value —
    // rebuilding it mid-session would silently discard in-memory local edits.
    // staleTime: Infinity means only an explicit invalidate/refetch() re-fetches.
    staleTime: Infinity,
  });
}

export function useSaveDoc(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: string) => saveDoc(id, update),
    onSuccess: (doc) => {
      // The list row's updatedAt/collaborators can move without a full
      // detail refetch — merge the summary in rather than invalidating
      // DOC_QUERY_KEY, which would refetch the snapshot and fight with the
      // local Yjs doc that's still the source of truth for content.
      queryClient.setQueryData<DocDetail>(DOC_QUERY_KEY(id), (prev) =>
        prev ? { ...prev, updatedAt: doc.updatedAt } : prev,
      );
      queryClient.setQueryData<DocSummary[]>(DOCS_QUERY_KEY, (prev) =>
        prev?.map((d) => (d.id === id ? doc : d)),
      );
    },
  });
}

export function useCreateDoc() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (title?: string) => createDoc(title),
    onSuccess: async (doc) => {
      await queryClient.invalidateQueries({ queryKey: DOCS_QUERY_KEY });
      router.push(ROUTES.doc(doc.id));
    },
  });
}

export function useRenameDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameDoc(id, title),
    onSuccess: (doc, { id }) => {
      queryClient.invalidateQueries({ queryKey: DOCS_QUERY_KEY });
      // Patch rather than invalidate: DOC_QUERY_KEY's staleTime is Infinity on
      // purpose (see useDoc), so an invalidate here would silently discard
      // the editor's in-memory Yjs doc the same way a stray refetch would.
      queryClient.setQueryData<DocDetail>(DOC_QUERY_KEY(id), (prev) =>
        prev ? { ...prev, title: doc.title, updatedAt: doc.updatedAt } : prev,
      );
    },
  });
}

export function useDeleteDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDoc(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCS_QUERY_KEY }),
  });
}

// Deliberately does not navigate, unlike useCreateDoc — duplicating from a
// row should leave the caller on the dashboard looking at the new row.
export function useDuplicateDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => duplicateDoc(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCS_QUERY_KEY }),
  });
}
