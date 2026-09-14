"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  ChangeRoleRequest,
  DocCollaboratorDto,
  InviteCollaboratorRequest,
} from "@docsync/shared";
import {
  changeCollaboratorRole,
  fetchCollaborators,
  inviteCollaborator,
  removeCollaborator,
} from "@/lib/api/collaborators";
import { DOCS_QUERY_KEY } from "./use-documents";

export const collaboratorsQueryKey = (docId: string) =>
  ["docs", "detail", docId, "collaborators"] as const;

export function useCollaborators(
  docId: string | null,
): UseQueryResult<DocCollaboratorDto[]> {
  return useQuery({
    queryKey: collaboratorsQueryKey(docId ?? "none"),
    queryFn: () => fetchCollaborators(docId as string),
    enabled: docId !== null,
  });
}

export function useInviteCollaborator(docId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: InviteCollaboratorRequest) =>
      inviteCollaborator(docId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: collaboratorsQueryKey(docId),
      });
      // Dashboard rows show a collaborator avatar stack via DocSummary — keep it in sync too.
      await queryClient.invalidateQueries({ queryKey: DOCS_QUERY_KEY });
    },
  });
}

export function useChangeCollaboratorRole(docId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: ChangeRoleRequest["role"];
    }) => changeCollaboratorRole(docId, userId, role),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: collaboratorsQueryKey(docId) }),
  });
}

export function useRemoveCollaborator(docId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeCollaborator(docId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: collaboratorsQueryKey(docId),
      });
      await queryClient.invalidateQueries({ queryKey: DOCS_QUERY_KEY });
    },
  });
}
