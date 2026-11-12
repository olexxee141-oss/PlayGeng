import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./governance.controller.js";
import { castBallotSchema, createElectionSchema } from "./governance.validator.js";

export const governanceRoutes = Router({ mergeParams: true });
governanceRoutes.use(requireAuth);
governanceRoutes.get("/", asyncHandler(controller.list));
governanceRoutes.post("/", validate(createElectionSchema), asyncHandler(controller.create));
governanceRoutes.get("/:electionId", asyncHandler(controller.getOne));
governanceRoutes.post("/:electionId/nominations", asyncHandler(controller.nominate));
governanceRoutes.delete("/:electionId/nominations/me", asyncHandler(controller.withdrawNomination));
governanceRoutes.post("/:electionId/ballots", validate(castBallotSchema), asyncHandler(controller.vote));
