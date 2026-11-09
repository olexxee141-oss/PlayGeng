import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./competitions.controller.js";
import * as invitationController from "./competition-invitations.controller.js";
import { createCompetitionInvitationSchema } from "./competition-invitations.validator.js";
import {
  createCompetitionSchema,
  registerCompetitionEntrySchema,
  reviewCompetitionEntrySchema,
  updateCompetitionStatusSchema,
} from "./competitions.validator.js";

export const competitionRoutes = Router({ mergeParams: true });
competitionRoutes.use(requireAuth);
competitionRoutes.get("/", asyncHandler(controller.list));
competitionRoutes.post("/", validate(createCompetitionSchema), asyncHandler(controller.create));
competitionRoutes.get("/:competitionId", asyncHandler(controller.getOne));
competitionRoutes.patch("/:competitionId/status", validate(updateCompetitionStatusSchema), asyncHandler(controller.transition));
competitionRoutes.get("/:competitionId/entries", asyncHandler(controller.listEntries));
competitionRoutes.post("/:competitionId/entries", validate(registerCompetitionEntrySchema), asyncHandler(controller.register));
competitionRoutes.patch("/:competitionId/entries/:entryId/review", validate(reviewCompetitionEntrySchema), asyncHandler(controller.reviewEntry));
competitionRoutes.delete("/:competitionId/entries/:entryId", asyncHandler(controller.withdrawEntry));
competitionRoutes.get("/:competitionId/invitations", asyncHandler(invitationController.list));
competitionRoutes.post("/:competitionId/invitations", validate(createCompetitionInvitationSchema), asyncHandler(invitationController.create));
competitionRoutes.post("/:competitionId/invitations/:invitationId/accept", asyncHandler(invitationController.accept));
competitionRoutes.post("/:competitionId/invitations/:invitationId/decline", asyncHandler(invitationController.decline));
