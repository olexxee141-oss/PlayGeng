import type { Request, RequestHandler, Response } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import * as service from "./communities.service.js";

const auth = (res: Response) => (res.locals as { auth: AuthContext }).auth;

const routeParam = (req: Request, name: string): string => {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new AppError("Invalid route parameter.", 400);
  }
  return value;
};

export const create: RequestHandler = async (req, res) => {
  const community = await service.createCommunity(auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { community } });
};

export const listMine: RequestHandler = async (_req, res) => {
  const communities = await service.listMyCommunities(auth(res).userId);
  res.status(200).json({ success: true, data: { communities } });
};

export const getOne: RequestHandler = async (req, res) => {
  const community = await service.getCommunity(routeParam(req, "communityId"), auth(res).userId);
  res.status(200).json({ success: true, data: { community } });
};

export const update: RequestHandler = async (req, res) => {
  const community = await service.updateCommunity(routeParam(req, "communityId"), auth(res).userId, req.body);
  res.status(200).json({ success: true, data: { community } });
};

export const archive: RequestHandler = async (req, res) => {
  await service.archiveCommunity(routeParam(req, "communityId"), auth(res).userId);
  res.status(204).send();
};

export const addMember: RequestHandler = async (req, res) => {
  const member = await service.addMember(routeParam(req, "communityId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { member } });
};

export const updateMemberRole: RequestHandler = async (req, res) => {
  const member = await service.updateMemberRole(
    routeParam(req, "communityId"),
    auth(res).userId,
    routeParam(req, "userId"),
    req.body.role,
  );
  res.status(200).json({ success: true, data: { member } });
};

export const removeMember: RequestHandler = async (req, res) => {
  await service.removeMember(routeParam(req, "communityId"), auth(res).userId, routeParam(req, "userId"));
  res.status(204).send();
};
