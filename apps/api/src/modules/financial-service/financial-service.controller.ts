import type { RequestHandler, Response } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import * as service from "./financial-service.service.js";

const auth = (res: Response) => (res.locals as { auth: AuthContext }).auth;
const communityId = (req: any) => {
  const value = req.params.communityId;
  if (typeof value !== "string" || !value) throw new AppError("Invalid route parameter.", 400);
  return value;
};

export const createCollection: RequestHandler = async (req, res) => {
  const collection = await service.createCollection(communityId(req), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { collection } });
};

export const listMine: RequestHandler = async (req, res) => {
  const collections = await service.listMyCollections(communityId(req), auth(res).userId);
  res.status(200).json({ success: true, data: { collections } });
};

export const ingestProviderEvent: RequestHandler = async (req, res) => {
  const result = await service.ingestProviderEvent(req.body);
  res.status(result.duplicate ? 200 : 201).json({ success: true, data: result });
};
