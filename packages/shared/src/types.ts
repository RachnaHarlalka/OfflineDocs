export type CollaboratorRole = "owner" | "editor" | "viewer";
export type AssignableCollaboratorRole = Exclude<CollaboratorRole, "owner">;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export type CsrfHeaderName = "X-CSRF-Token";

export interface MeResponse {
  user: AuthUser;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface Doc {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocCollaboratorSummary {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface DocSummary extends Doc {
  role: CollaboratorRole;
  collaborators: DocCollaboratorSummary[];
}

export interface DocDetail extends Doc {
  snapshot: string | null;
  role: CollaboratorRole;
}

export interface DocCollaboratorDto {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: CollaboratorRole;
}

export interface InviteCollaboratorRequest {
  email: string;
  role: AssignableCollaboratorRole;
}

export interface ChangeRoleRequest {
  role: AssignableCollaboratorRole;
}

export interface CreateDocRequest {
  title?: string;
}

export interface RenameDocRequest {
  title: string;
}

export interface DocsResponse {
  docs: DocSummary[];
}

export interface DocResponse {
  doc: DocSummary;
}

export interface DocDetailResponse {
  doc: DocDetail;
}

export interface CollaboratorsResponse {
  collaborators: DocCollaboratorDto[];
}

export interface CollaboratorResponse {
  collaborator: DocCollaboratorDto;
}

export interface SaveRequest {
  update: string;
}

export interface PushPayload {
  docId: string;
  docTitle: string;
  editorName: string;
  changeSummary: string;
}
