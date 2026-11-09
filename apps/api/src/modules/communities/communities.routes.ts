import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./communities.controller.js";
import { addMemberSchema, createCommunitySchema, updateCommunitySchema, updateMemberRoleSchema } from "./communities.validator.js";

export const communityRoutes = Router();

communityRoutes.use(requireAuth);
communityRoutes.get("/", asyncHandler(controller.listMine));
communityRoutes.post("/", validate(createCommunitySchema), asyncHandler(controller.create));
communityRoutes.get("/:communityId", asyncHandler(controller.getOne));
communityRoutes.patch("/:communityId", validate(updateCommunitySchema), asyncHandler(controller.update));
communityRoutes.delete("/:communityId", asyncHandler(controller.archive));
communityRoutes.post("/:communityId/members", validate(addMemberSchema), asyncHandler(controller.addMember));
communityRoutes.patch("/:communityId/members/:userId", validate(updateMemberRoleSchema), asyncHandler(controller.updateMemberRole));
communityRoutes.delete("/:communityId/members/:userId", asyncHandler(controller.removeMember));
