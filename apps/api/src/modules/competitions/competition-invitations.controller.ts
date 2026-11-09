import type { Request, RequestHandler, Response } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import * as service from "./competition-invitations.service.js";

const auth = (res: Response) => (res.locals as { auth: AuthContext }).auth;
const param = (req: Request, name: string) => {
  const value = req.params[name];
  if (typeof value !== "string" || !value) throw new AppError("Invalid route parameter.", 400);
  return value;
};

export const create: RequestHandler = async (req, res) => {
  const invitation = await service.createInvitation(
    param(req, "communityId"),
    param(req, "competitionId"),
    auth(res).userId,
    req.body,
  );
  res.status(201).json({ success: true, data: { invitation } });
};

export const list: RequestHandler = async (req, res) => {
  const invitations = await service.listInvitations(param(req, "communityId"), param(req, "competitionId"), auth(res).userId);
  res.status(200).json({ success: true, data: { invitations } });
};

export const accept: RequestHandler = async (req, res) => {
  const entry = await service.acceptInvitation(
    param(req, "communityId"),
    param(req, "competitionId"),
    param(req, "invitationId"),
    auth(res).userId,
  );
  res.status(201).json({ success: true, data: { entry } });
};

export const decline: RequestHandler = async (req, res) => {
  await service.declineInvitation(
    param(req, "communityId"),
    param(req, "competitionId"),
    param(req, "invitationId"),
    auth(res).userId,
  );
  res.status(204).send();
};
