import { Router } from "express";
import * as docsController from "../controllers/docs.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/require-role.js";
import { validate } from "../middleware/validate.js";
import { createDocSchema, renameDocSchema, saveDocSchema } from "../validators/docs.js";

export const docsRouter = Router();

docsRouter.use(requireAuth);

docsRouter.get("/", docsController.list);
docsRouter.post("/", validate("body", createDocSchema), docsController.create);
docsRouter.get("/:id", requireRole("viewer"), docsController.detail);
docsRouter.patch(
  "/:id",
  requireRole("owner"),
  validate("body", renameDocSchema),
  docsController.rename,
);
docsRouter.delete("/:id", requireRole("owner"), docsController.remove);
docsRouter.post("/:id/duplicate", requireRole("viewer"), docsController.duplicate);
docsRouter.post(
  "/:id/save",
  requireRole("editor"),
  validate("body", saveDocSchema),
  docsController.save,
);
