import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./teams.controller.js";
import { addTeamMemberSchema, createTeamSchema, enableSportSchema, updateTeamMemberSchema, updateTeamSchema } from "./teams.validator.js";

export const teamRoutes = Router({ mergeParams: true });
teamRoutes.use(requireAuth);

teamRoutes.get("/sports", asyncHandler(controller.listSports));
teamRoutes.post("/sports", validate(enableSportSchema), asyncHandler(controller.enableSport));
teamRoutes.delete("/sports/:sport", asyncHandler(controller.removeSport));

teamRoutes.get("/teams", asyncHandler(controller.listTeams));
teamRoutes.post("/teams", validate(createTeamSchema), asyncHandler(controller.createTeam));
teamRoutes.get("/teams/:teamId", asyncHandler(controller.getTeam));
teamRoutes.patch("/teams/:teamId", validate(updateTeamSchema), asyncHandler(controller.updateTeam));
teamRoutes.delete("/teams/:teamId", asyncHandler(controller.archiveTeam));
teamRoutes.post("/teams/:teamId/members", validate(addTeamMemberSchema), asyncHandler(controller.addTeamMember));
teamRoutes.patch("/teams/:teamId/members/:userId", validate(updateTeamMemberSchema), asyncHandler(controller.updateTeamMemberRole));
teamRoutes.delete("/teams/:teamId/members/:userId", asyncHandler(controller.removeTeamMember));
