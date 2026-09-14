import type { NextFunction, Request, Response } from "express";
import type { CollaboratorRole } from "@docsync/shared";
import { prisma } from "../db/client.js";
import { AppError } from "../lib/http-error.js";

export interface DocAccess {
  docId: string;
  role: CollaboratorRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by `requireRole`. Absent on routes that don't gate on doc access. */
      docAccess?: DocAccess;
    }
  }
}

// Runtime value, so it can't live in packages/shared (type-only constraint from CP-B1).
const ROLE_RANK: Record<CollaboratorRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

/**
 * No row for the caller on this doc -> notFound, not forbidden. A 403 would let a
 * non-collaborator distinguish "doc exists" from "doc doesn't exist" by status code.
 * A row that exists but ranks below `minimum` -> forbidden; the caller already knows
 * the doc exists, so nothing new leaks there.
 */
export function requireRole(minimum: CollaboratorRole) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const docId = req.params.id as string;
      const userId = req.user?.id;
      if (!userId) throw new Error("requireRole used without requireAuth");

      const access = await prisma.docCollaborator.findUnique({
        where: { docId_userId: { docId, userId } },
        select: { role: true },
      });

      if (!access) throw AppError.notFound("Document not found");
      if (ROLE_RANK[access.role] < ROLE_RANK[minimum]) {
        throw AppError.forbidden("You do not have access to this document");
      }

      req.docAccess = { docId, role: access.role };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function getDocAccess(req: Request): DocAccess {
  if (!req.docAccess) {
    throw new Error("getDocAccess called on a route without requireRole");
  }
  return req.docAccess;
}
