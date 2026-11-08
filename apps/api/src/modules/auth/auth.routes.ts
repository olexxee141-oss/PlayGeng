import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { validate } from "../../shared/middlewares/validate.middleware.js";
import * as controller from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  verifyEmailSchema,
  authBodySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validator.js";

export const authRoutes = Router();

authRoutes.post("/register", validate(registerSchema), asyncHandler(controller.register));
authRoutes.post("/login", validate(loginSchema), asyncHandler(controller.login));
authRoutes.post("/refresh", validate(refreshSchema), asyncHandler(controller.refresh));
authRoutes.post("/logout", validate(authBodySchema), asyncHandler(controller.logout));
authRoutes.post("/verify-email", validate(verifyEmailSchema), asyncHandler(controller.verifyEmail));
authRoutes.post("/forgot-password", validate(forgotPasswordSchema), asyncHandler(controller.forgotPassword));
authRoutes.post("/reset-password", validate(resetPasswordSchema), asyncHandler(controller.resetPassword));
authRoutes.get("/me", requireAuth, asyncHandler(controller.me));
