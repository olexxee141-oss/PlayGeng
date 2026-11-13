import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./assembly.controller.js";
import { submitAssemblyCaseSchema } from "./assembly.validator.js";
import { declareAssemblyConflictSchema, decideAssemblyConflictSchema, respondToAssemblyConflictSchema } from "./assembly.conflicts.validator.js";
import { castAssemblyBallotSchema } from "./assembly.voting.validator.js";

export const assemblyRoutes = Router({ mergeParams: true });
assemblyRoutes.use(requireAuth);
assemblyRoutes.get("/cases/mine", asyncHandler(controller.listMyCases));
assemblyRoutes.post("/cases", validate(submitAssemblyCaseSchema), asyncHandler(controller.submitCase));
assemblyRoutes.delete("/cases/:caseId", asyncHandler(controller.withdrawCase));

assemblyRoutes.get("/cases/:caseId/conflicts/mine", asyncHandler(controller.listMyConflicts));
assemblyRoutes.post("/cases/:caseId/conflicts", validate(declareAssemblyConflictSchema), asyncHandler(controller.declareConflict));
assemblyRoutes.delete("/cases/:caseId/conflicts/:declarationId", asyncHandler(controller.withdrawConflict));
assemblyRoutes.post("/cases/:caseId/conflict-review/start", asyncHandler(controller.startConflictReview));
assemblyRoutes.post("/cases/:caseId/conflicts/:declarationId/decisions", validate(decideAssemblyConflictSchema), asyncHandler(controller.decideConflict));
assemblyRoutes.post("/cases/:caseId/electorate/freeze", asyncHandler(controller.freezeElectorate));
assemblyRoutes.post("/cases/:caseId/conflicts/:declarationId/response", validate(respondToAssemblyConflictSchema), asyncHandler(controller.respondToConflict));
assemblyRoutes.get("/cases/:caseId/conflicts", asyncHandler(controller.listConflictDocket));
assemblyRoutes.post("/cases/:caseId/notice", asyncHandler(controller.publishAssemblyNotice));
assemblyRoutes.post("/cases/:caseId/voting/open", asyncHandler(controller.openAssemblyVoting));
assemblyRoutes.post("/cases/:caseId/ballots", validate(castAssemblyBallotSchema), asyncHandler(controller.castAssemblyBallot));
assemblyRoutes.post("/cases/:caseId/voting/finalize", asyncHandler(controller.finalizeAssemblyVoting));
assemblyRoutes.get("/cases/:caseId/voting", asyncHandler(controller.getAssemblyVotingStatus));
