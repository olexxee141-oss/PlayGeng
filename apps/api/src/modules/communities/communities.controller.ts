import type { RequestHandler } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import * as service from "./communities.service.js";

const auth = (res: Parameters<RequestHandler>[1]) => (res.locals as { auth: AuthContext }).auth;

export const create: RequestHandler = async (req, res) => {
  const community = await service.createCommunity(auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { community } });
};

export const listMine: RequestHandler = async (_req, res) => {
  const communities = await service.listMyCommunities(auth(res).userId);
  res.status(200).json({ success: true, data: { communities } });
};

export const getOne: RequestHandler = async (req, res) => {
  const community = await service.getCommunity(req.params.communityId, auth(res).userId);
  res.status(200).json({ success: true, data: { community } });
};

export const update: RequestHandler = async (req, res) => {
  const community = await service.updateCommunity(req.params.communityId, auth(res).userId, req.body);
  res.status(200).json({ success: true, data: { community } });
};

export const archive: RequestHandler = async (req, res) => {
  await service.archiveCommunity(req.params.communityId, auth(res).userId);
  res.status(204).send();
};

export const addMember: RequestHandler = async (req, res) => {
  const member = await service.addMember(req.params.communityId, auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { member } });
};

export const updateMemberRole: RequestHandler = async (req, res) => {
  const member = await service.updateMemberRole(req.params.communityId, auth(res).userId, req.params.userId, req.body.role);
  res.status(200).json({ success: true, data: { member } });
};

export const removeMember: RequestHandler = async (req, res) => {
  await service.removeMember(req.params.communityId, auth(res).userId, req.params.userId);
  res.status(204).send();
};
