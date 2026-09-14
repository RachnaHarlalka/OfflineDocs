import type {
  AssignableCollaboratorRole,
  CollaboratorRole,
} from "@docsync/shared";
import { prisma } from "../db/client.js";
import { AppError } from "../lib/http-error.js";
import type { UserModel } from "../generated/prisma/models.js";

const USER_FIELDS = {
  avatarUrl: true,
  email: true,
  name: true,
} as const;

export type CollaboratorUser = Pick<UserModel, keyof typeof USER_FIELDS>;

export interface DocCollaboratorRow {
  userId: string;
  role: CollaboratorRole;
  user: CollaboratorUser;
}

export async function listCollaborators(
  docId: string,
): Promise<DocCollaboratorRow[]> {
  return prisma.docCollaborator.findMany({
    where: { docId },
    select: {
      userId: true,
      role: true,
      user: {
        select: USER_FIELDS,
      },
    },
  });
}

export async function inviteCollaborator(
  docId: string,
  email: string,
  role: AssignableCollaboratorRole,
): Promise<DocCollaboratorRow> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (!user) {
    throw AppError.notFound(
      "No account found for that email",
      "invite_user_not_found",
    );
  }

  const existing = await prisma.docCollaborator.findUnique({
    where: { docId_userId: { docId, userId: user.id } },
  });

  if (existing) {
    throw AppError.conflict(
      "This user is already a collaborator on this document",
      "already_collaborator",
      { role: existing.role },
    );
  }

  return prisma.docCollaborator.create({
    data: { docId, userId: user.id, role },
    select: {
      userId: true,
      role: true,
      user: { select: USER_FIELDS },
    },
  });
}

export async function changeRole(
  docId: string,
  targetUserId: string,
  newRole: AssignableCollaboratorRole,
): Promise<DocCollaboratorRow> {
  return prisma.$transaction(async (tx) => {
    const target = await tx.docCollaborator.findUnique({
      where: { docId_userId: { docId, userId: targetUserId } },
    });

    if (!target) throw AppError.notFound("Collaborator not found");

    if (target.role === "owner") {
      const ownerCount = await tx.docCollaborator.count({
        where: { docId, role: "owner" },
      });
      if (ownerCount <= 1) {
        throw AppError.badRequest(
          "Cannot change role : this is the last owner",
          undefined,
          "last_owner",
        );
      }
    }

    return tx.docCollaborator.update({
      where: { docId_userId: { docId, userId: targetUserId } },
      data: {
        role: newRole,
      },
      select: {
        userId: true,
        role: true,
        user: { select: USER_FIELDS },
      },
    });
  });
}

export async function removeCollaborator(
  docId: string,
  targetUserId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const target = await tx.docCollaborator.findUnique({
      where: {
        docId_userId: { docId, userId: targetUserId },
      },
    });

    if (!target) {
      throw AppError.notFound("Collaborator not found");
    }

    if (target.role === "owner") {
      const ownerCount = await tx.docCollaborator.count({
        where: {
          docId,
          role: "owner",
        },
      });
      if (ownerCount <= 1) {
        throw AppError.badRequest(
          "Cannot delete this owner",
          undefined,
          "last_owner",
        );
      }
    }

    await tx.docCollaborator.delete({
      where: {
        docId_userId: { docId, userId: targetUserId },
      },
    });
  });
}
