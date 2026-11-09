import type { Request, RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthContext } from "../auth/auth.middleware.js";
import * as service from "./matches.service.js";

const auth = (res: Response) => (res.locals as { auth: AuthContext }).auth;
const param = (req: Request, key: string) => {
  const value = req.params[key];
  if (typeof value !== "string" || value.length === 0) throw new AppError("Invalid route parameter.", 400);
  return value;
};

export const create: RequestHandler = async (req, res) => {
  const match = await service.createMatch(param(req, "communityId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { match } });
};

export const list: RequestHandler = async (req, res) => {
  const matches = await service.listMatches(param(req, "communityId"), auth(res).userId);
  res.status(200).json({ success: true, data: { matches } });
};

export const getOne: RequestHandler = async (req, res) => {
  const match = await service.getMatch(param(req, "communityId"), param(req, "matchId"), auth(res).userId);
  res.status(200).json({ success: true, data: { match } });
};

export const update: RequestHandler = async (req, res) => {
  const match = await service.updateMatch(param(req, "communityId"), param(req, "matchId"), auth(res).userId, req.body);
  res.status(200).json({ success: true, data: { match } });
};

export const cancel: RequestHandler = async (req, res) => {
  const match = await service.cancelMatch(param(req, "communityId"), param(req, "matchId"), auth(res).userId);
  res.status(200).json({ success: true, data: { match } });
};

export const join: RequestHandler = async (req, res) => {
  const participant = await service.joinMatch(param(req, "communityId"), param(req, "matchId"), auth(res).userId);
  res.status(201).json({ success: true, data: { participant } });
};

export const leave: RequestHandler = async (req, res) => {
  const participant = await service.leaveMatch(param(req, "communityId"), param(req, "matchId"), auth(res).userId);
  res.status(200).json({ success: true, data: { participant } });
};

export const attendance: RequestHandler = async (req, res) => {
  const participant = await service.recordAttendance(
    param(req, "communityId"),
    param(req, "matchId"),
    auth(res).userId,
    param(req, "userId"),
    req.body,
  );
  res.status(200).json({ success: true, data: { participant } });
};
