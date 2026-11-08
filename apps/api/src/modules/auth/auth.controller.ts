import type { RequestHandler } from "express";
import * as authService from "./auth.service.js";
import type { AuthContext } from "./auth.middleware.js";

const metadata = (req: Parameters<RequestHandler>[0]) => ({
  ...(req.get("user-agent") ? { userAgent: req.get("user-agent") } : {}),
  ...(req.ip ? { ipAddress: req.ip } : {}),
});

export const register: RequestHandler = async (req, res) => {
  const data = await authService.register(req.body, metadata(req));
  res.status(201).json({ success: true, message: data.message, data });
};

export const login: RequestHandler = async (req, res) => {
  const data = await authService.login(req.body, metadata(req));
  res.status(200).json({ success: true, message: "Signed in successfully.", data });
};

export const refresh: RequestHandler = async (req, res) => {
  const data = await authService.refresh(req.body.refreshToken);
  res.status(200).json({ success: true, message: "Session refreshed.", data });
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(req.body?.refreshToken);
  res.status(200).json({ success: true, message: "Signed out successfully." });
};

export const verifyEmail: RequestHandler = async (req, res) => {
  const data = await authService.verifyEmail(req.body.token);
  res.status(200).json({ success: true, message: data.message, data });
};

export const me: RequestHandler = async (_req, res) => {
  const auth = (res.locals as { auth: AuthContext }).auth;
  const user = await authService.getCurrentUser(auth.userId);
  res.status(200).json({ success: true, data: { user } });
};

export const forgotPassword: RequestHandler = async (req, res) => {
  const data = await authService.forgotPassword(req.body.email);
  res.status(200).json({ success: true, message: data.message, data });
};

export const resetPassword: RequestHandler = async (req, res) => {
  const data = await authService.resetPassword(req.body.token, req.body.password);
  res.status(200).json({ success: true, message: data.message });
};
