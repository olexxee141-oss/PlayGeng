import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./treasury.controller.js";
import { initializeTreasurySchema, postJournalSchema, reverseJournalSchema } from "./treasury.validator.js";

export const treasuryRoutes = Router({ mergeParams: true });
treasuryRoutes.use(requireAuth);
treasuryRoutes.get("/", asyncHandler(controller.getOne));
treasuryRoutes.post("/", validate(initializeTreasurySchema), asyncHandler(controller.initialize));
treasuryRoutes.get("/journal", asyncHandler(controller.listJournal));
treasuryRoutes.post("/journal", validate(postJournalSchema), asyncHandler(controller.postJournal));
treasuryRoutes.post("/journal/:transactionId/reverse", validate(reverseJournalSchema), asyncHandler(controller.reverseJournal));
