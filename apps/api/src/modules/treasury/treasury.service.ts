import { AppError } from "../../shared/errors/app-error.js";
import * as db from "./treasury.db.js";
import type { InitializeTreasuryInput, PostJournalInput, ReverseJournalInput } from "./treasury.validator.js";

const requireActiveMember = async (communityId: string, userId: string) => {
  const membership = await db.findCommunityAccess(communityId, userId);
  if (!membership || membership.user.status !== "ACTIVE" || membership.community.status !== "ACTIVE") throw new AppError("Community not found.", 404);
  return membership;
};

const requireTreasurer = async (communityId: string, userId: string) => {
  const membership = await requireActiveMember(communityId, userId);
  if (membership.role !== "TREASURER") throw new AppError("Only the elected Treasurer can perform this financial operation.", 403);
  return membership;
};

const requireFinanceReader = async (communityId: string, userId: string) => {
  const membership = await requireActiveMember(communityId, userId);
  if (membership.role !== "TREASURER" && membership.role !== "ADMIN") throw new AppError("You do not have permission to view the community treasury.", 403);
  return membership;
};

const assertSupportedCurrency = (currency: string) => {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("currency");
  if (supported && !supported.includes(currency)) throw new AppError("Currency must be a supported ISO-4217 currency code.", 400);
  try { new Intl.NumberFormat("en", { style: "currency", currency }).format(1); }
  catch { throw new AppError("Currency must be a supported ISO-4217 currency code.", 400); }
};

export const initializeTreasury = async (communityId: string, actorId: string, input: InitializeTreasuryInput) => {
  await requireTreasurer(communityId, actorId);
  assertSupportedCurrency(input.currency);
  const result = await db.initializeTreasury(communityId, actorId, input.currency);
  if (result.kind === "EXISTS") throw new AppError("This community already has a treasury.", 409);
  return result.treasury;
};

export const getTreasury = async (communityId: string, userId: string) => {
  await requireFinanceReader(communityId, userId);
  const treasury = await db.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  const balances = await db.getAccountBalances(treasury.id);
  return { ...treasury, balances };
};

export const postJournalTransaction = async (communityId: string, actorId: string, input: PostJournalInput) => {
  await requireTreasurer(communityId, actorId);
  const treasury = await db.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  let debit = 0n, credit = 0n;
  for (const posting of input.postings) {
    const amount = BigInt(posting.amountMinor);
    if (posting.side === "DEBIT") debit += amount; else credit += amount;
  }
  if (input.postings.length < 2 || !input.postings.some((p) => p.side === "DEBIT") || !input.postings.some((p) => p.side === "CREDIT") || debit !== credit) {
    throw new AppError("Journal postings must contain debits and credits with equal totals.", 400);
  }
  const codes = [...new Set(input.postings.map((posting) => posting.accountCode))];
  const accounts = await import("@playgeng/database").then(({ prisma }) => prisma.treasuryAccount.findMany({
    where: { treasuryId: treasury.id, code: { in: codes }, isActive: true },
  }));
  if (accounts.length !== codes.length) throw new AppError("One or more ledger accounts are invalid or inactive.", 400);
  const accountByCode = new Map(accounts.map((account) => [account.code, account.id]));
  const result = await db.postJournal({
    treasuryId: treasury.id, actorId, type: input.type, description: input.description,
    idempotencyKey: input.idempotencyKey,
    ...(input.sourceType ? { sourceType: input.sourceType } : {}),
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    postings: input.postings.map((posting) => ({ accountId: accountByCode.get(posting.accountCode)!, side: posting.side, amountMinor: BigInt(posting.amountMinor) })),
  });
  if (result.kind === "EXISTS") {
    const expected = input.postings.map((p) => ({ code: p.accountCode, side: p.side, amount: p.amountMinor })).sort((a,b) => a.code.localeCompare(b.code) || a.side.localeCompare(b.side) || a.amount.localeCompare(b.amount));
    const actual = result.transaction.postings.map((p) => ({ code: p.account.code, side: p.side, amount: p.amountMinor.toString() })).sort((a,b) => a.code.localeCompare(b.code) || a.side.localeCompare(b.side) || a.amount.localeCompare(b.amount));
    if (result.transaction.type !== input.type || result.transaction.description !== input.description || JSON.stringify(expected) !== JSON.stringify(actual)) {
      throw new AppError("Idempotency key has already been used for a different journal transaction.", 409);
    }
    return result.transaction;
  }
  return result.transaction;
};

export const reverseJournalTransaction = async (communityId: string, actorId: string, transactionId: string, input: ReverseJournalInput) => {
  await requireTreasurer(communityId, actorId);
  const treasury = await db.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  const result = await db.reverseJournal({ treasuryId: treasury.id, transactionId, actorId, ...input });
  if (result.kind === "NOT_FOUND") throw new AppError("Posted journal transaction not found.", 404);
  if (result.kind === "ALREADY_REVERSED") throw new AppError("This journal transaction has already been reversed.", 409);
  if (result.kind === "IDEMPOTENCY_CONFLICT") throw new AppError("Idempotency key has already been used.", 409);
  return result.transaction;
};

export const listJournalTransactions = async (communityId: string, userId: string, cursor?: string, limit = 50) => {
  await requireFinanceReader(communityId, userId);
  const treasury = await db.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  return db.listJournal(treasury.id, cursor, limit);
};
