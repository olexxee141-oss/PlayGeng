import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./review-council.controller.js";
import { castReviewCouncilBallotSchema, createReviewCouncilElectionSchema, resignReviewCouncilMembershipSchema } from "./review-council.validator.js";

export const reviewCouncilRoutes = Router({ mergeParams: true });
reviewCouncilRoutes.use(requireAuth);
reviewCouncilRoutes.get("/members", asyncHandler(controller.members));
reviewCouncilRoutes.get("/members/history", asyncHandler(controller.membershipHistory));
reviewCouncilRoutes.delete("/members/me", validate(resignReviewCouncilMembershipSchema), asyncHandler(controller.resign));
reviewCouncilRoutes.get("/", asyncHandler(controller.list));
reviewCouncilRoutes.post("/", validate(createReviewCouncilElectionSchema), asyncHandler(controller.create));
reviewCouncilRoutes.get("/:electionId", asyncHandler(controller.getOne));
reviewCouncilRoutes.post("/:electionId/nominations", asyncHandler(controller.nominate));
reviewCouncilRoutes.delete("/:electionId/nominations/me", asyncHandler(controller.withdrawNomination));
reviewCouncilRoutes.post("/:electionId/ballots", validate(castReviewCouncilBallotSchema), asyncHandler(controller.vote));
