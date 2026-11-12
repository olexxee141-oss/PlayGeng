import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./obligations.controller.js";
import { cancelObligationSchema, createObligationSchema } from "./obligations.validator.js";

export const obligationRoutes = Router({ mergeParams: true });
obligationRoutes.use(requireAuth);
obligationRoutes.get("/mine", asyncHandler(controller.listMine));
obligationRoutes.get("/", asyncHandler(controller.listAll));
obligationRoutes.post("/", validate(createObligationSchema), asyncHandler(controller.create));
obligationRoutes.get("/:obligationId", asyncHandler(controller.getOne));
obligationRoutes.post("/:obligationId/cancel", validate(cancelObligationSchema), asyncHandler(controller.cancel));
