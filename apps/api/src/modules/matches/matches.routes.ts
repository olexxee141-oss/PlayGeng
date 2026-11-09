import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./matches.controller.js";
import { attendanceSchema, createMatchSchema, updateMatchSchema } from "./matches.validator.js";

export const matchRoutes = Router({ mergeParams: true });
matchRoutes.use(requireAuth);
matchRoutes.get("/", asyncHandler(controller.list));
matchRoutes.post("/", validate(createMatchSchema), asyncHandler(controller.create));
matchRoutes.get("/:matchId", asyncHandler(controller.getOne));
matchRoutes.patch("/:matchId", validate(updateMatchSchema), asyncHandler(controller.update));
matchRoutes.post("/:matchId/cancel", asyncHandler(controller.cancel));
matchRoutes.post("/:matchId/join", asyncHandler(controller.join));
matchRoutes.delete("/:matchId/leave", asyncHandler(controller.leave));
matchRoutes.patch("/:matchId/participants/:userId/attendance", validate(attendanceSchema), asyncHandler(controller.attendance));
