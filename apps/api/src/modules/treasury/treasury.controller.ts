import type { Request, RequestHandler, Response } from "express";
import type { AuthContext } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import * as service from "./treasury.service.js";

const auth = (res: Response) => (res.locals as { auth: AuthContext }).auth;
const param = (req: Request, name: string) => {
  const value = req.params[name];
  if (typeof value !== "string" || !value) throw new AppError("Invalid route parameter.", 400);
  return value;
};

export const initialize: RequestHandler = async (req, res) => {
  const treasury = await service.initializeTreasury(param(req, "communityId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { treasury } });
};

export const getOne: RequestHandler = async (req, res) => {
  const treasury = await service.getTreasury(param(req, "communityId"), auth(res).userId);
  res.status(200).json({ success: true, data: { treasury } });
};

export const postJournal: RequestHandler = async (req, res) => {
  const transaction = await service.postJournalTransaction(param(req, "communityId"), auth(res).userId, req.body);
  res.status(201).json({ success: true, data: { transaction } });
};

export const listJournal: RequestHandler = async (req, res) => {
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError("Invalid page limit.", 400);
  const transactions = await service.listJournalTransactions(param(req, "communityId"), auth(res).userId, cursor, limit);
  res.status(200).json({ success: true, data: { transactions } });
};

export const reverseJournal: RequestHandler = async (req, res) => {
  const transaction = await service.reverseJournalTransaction(param(req, "communityId"), auth(res).userId, param(req, "transactionId"), req.body);
  res.status(201).json({ success: true, data: { transaction } });
};
