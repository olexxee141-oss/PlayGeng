import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./assembly.controller.js";
import { submitAssemblyCaseSchema } from "./assembly.validator.js";

export const assemblyRoutes = Router({ mergeParams: true });
assemblyRoutes.use(requireAuth);
assemblyRoutes.get("/cases/mine", asyncHandler(controller.listMyCases));
assemblyRoutes.post("/cases", validate(submitAssemblyCaseSchema), asyncHandler(controller.submitCase));
assemblyRoutes.delete("/cases/:caseId", asyncHandler(controller.withdrawCase));
