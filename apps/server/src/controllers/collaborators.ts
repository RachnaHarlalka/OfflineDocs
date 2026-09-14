import type { Request, Response } from "express";
import type {
  ChangeRoleRequest,
  CollaboratorResponse,
  CollaboratorsResponse,
  DocCollaboratorDto,
  InviteCollaboratorRequest,
} from "@docsync/shared";
import {
  changeRole,
  type DocCollaboratorRow,
  inviteCollaborator,
  listCollaborators,
  removeCollaborator,
} from "../services/collaborators.js";
import { getDocAccess } from "../middleware/require-role.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import { AppError } from "../lib/http-error.js";

function toDocCollaboratorDto(row: DocCollaboratorRow): DocCollaboratorDto {
  return {
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    avatarUrl: row.user.avatarUrl,
    role: row.role,
  };
}
export async function list(
  req: Request,
  res: Response<CollaboratorsResponse>,
): Promise<void> {
  const { docId } = getDocAccess(req);
  const rows = await listCollaborators(docId);
  res.json({
    collaborators: rows.map(toDocCollaboratorDto),
  });
}

export async function invite(
  req: Request,
  res: Response<CollaboratorResponse>,
): Promise<void> {
  const { docId } = getDocAccess(req);
  const { email, role } = req.body as unknown as InviteCollaboratorRequest;
  const row = await inviteCollaborator(docId, email, role);
  res.status(201).json({
    collaborator: toDocCollaboratorDto(row),
  });
}

export async function changeRoleHandler(
  req: Request,
  res: Response<CollaboratorResponse>,
): Promise<void> {
  const { docId } = getDocAccess(req);
  const targetUserId = req.params.userId as string;
  const { role } = req.body as unknown as ChangeRoleRequest;
  const row = await changeRole(docId, targetUserId, role);
  res.json({ collaborator: toDocCollaboratorDto(row) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { docId, role } = getDocAccess(req);
  const targetUserId = req.params.userId as string;
  const { id: callerId } = getAuthenticatedUser(req);

  if (targetUserId !== callerId && role !== "owner") {
    throw AppError.forbidden("Only the owner can remove another collaborator");
  }

  await removeCollaborator(docId, targetUserId);
  res.status(204).send();
}
