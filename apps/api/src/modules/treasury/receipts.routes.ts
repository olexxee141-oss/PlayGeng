import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./receipts.controller.js";
import { createManualReceiptSchema } from "./receipts.validator.js";

export const receiptRoutes = Router({ mergeParams: true });
receiptRoutes.use(requireAuth);
receiptRoutes.get("/mine", asyncHandler(controller.listMine));
receiptRoutes.get("/", asyncHandler(controller.listAll));
receiptRoutes.post("/", validate(createManualReceiptSchema), asyncHandler(controller.verifyManual));
receiptRoutes.get("/:receiptId", asyncHandler(controller.getOne));
