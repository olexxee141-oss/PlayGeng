import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./financial-service.controller.js";
import { createCollectionSchema, ingestProviderEventSchema } from "./financial-service.validator.js";

export const financialServiceRoutes = Router({ mergeParams: true });
financialServiceRoutes.use(requireAuth);
financialServiceRoutes.get("/collections/mine", asyncHandler(controller.listMine));
financialServiceRoutes.post("/collections", validate(createCollectionSchema), asyncHandler(controller.createCollection));

// Temporary authenticated ingestion boundary. A provider-specific adapter will replace this
// with signature-validated webhook handling before any live provider is enabled.
// Provider-event ingestion is intentionally not exposed through this member-authenticated router.
// A provider-specific webhook adapter must validate authenticity before calling the service.
