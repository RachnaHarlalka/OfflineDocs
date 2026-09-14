import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/require-role.js";
import * as collaboratorsController from "../controllers/collaborators.js";
import {
  changeRoleSchema,
  inviteCollaboratorSchema,
} from "../validators/collaborators.js";
import { validate } from "../middleware/validate.js";

export const collaboratorsRouter = Router({ mergeParams: true });

collaboratorsRouter.use(requireAuth);

collaboratorsRouter.get(
  "/",
  requireRole("viewer"),
  collaboratorsController.list,
);

collaboratorsRouter.post(
  "/",
  requireRole("owner"),
  validate("body", inviteCollaboratorSchema),
  collaboratorsController.invite,
);

collaboratorsRouter.patch(
  "/:userId",
  requireRole("owner"),
  validate("body", changeRoleSchema),
  collaboratorsController.changeRoleHandler,
);

collaboratorsRouter.delete(
  "/:userId",
  requireRole("viewer"),
  collaboratorsController.remove,
);
