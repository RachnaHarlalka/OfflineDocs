import type {
  ChangeRoleRequest,
  CollaboratorResponse,
  CollaboratorsResponse,
  DocCollaboratorDto,
  InviteCollaboratorRequest,
} from "@docsync/shared";
import { API } from "@/constants/routes";
import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export async function fetchCollaborators(
  docId: string,
): Promise<DocCollaboratorDto[]> {
  const { collaborators } = await apiGet<CollaboratorsResponse>(
    API.docCollaborators(docId),
  );
  return collaborators;
}

export async function inviteCollaborator(
  docId: string,
  body: InviteCollaboratorRequest,
): Promise<DocCollaboratorDto> {
  const { collaborator } = await apiPost<CollaboratorResponse>(
    API.docCollaborators(docId),
    body,
  );
  return collaborator;
}

export async function changeCollaboratorRole(
  docId: string,
  userId: string,
  role: ChangeRoleRequest["role"],
): Promise<DocCollaboratorDto> {
  const { collaborator } = await apiPatch<CollaboratorResponse>(
    API.docCollaborator(docId, userId),
    { role },
  );
  return collaborator;
}

export async function removeCollaborator(
  docId: string,
  userId: string,
): Promise<void> {
  await apiDelete(API.docCollaborator(docId, userId));
}
