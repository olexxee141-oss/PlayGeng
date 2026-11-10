import { prisma } from "@playgeng/database";
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
  const cashPosting = input.postings.some((posting) => posting.accountCode === "CASH");
  if (cashPosting && input.type !== "OPENING_BALANCE") throw new AppError("Cash can only be introduced through a documented opening balance or a verified receipt workflow.", 400);
  if (input.type === "OPENING_BALANCE" && (
    input.postings.length !== 2 ||
    input.postings[0]?.accountCode !== "CASH" ||
    input.postings[0]?.side !== "DEBIT" ||
    input.postings[1]?.accountCode !== "OPENING_EQUITY" ||
    input.postings[1]?.side !== "CREDIT" ||
    !input.sourceType || !input.sourceId
  )) throw new AppError("Opening balance must debit CASH and credit OPENING_EQUITY with a supporting source reference.", 400);
  if (input.type === "ADJUSTMENT" && input.postings.some((posting) => ["CASH", "RECEIVABLES", "CONTRIBUTION_INCOME", "MATCH_INCOME", "REGISTRATION_INCOME"].includes(posting.accountCode))) {
    throw new AppError("Cash, receivables and operational income must be changed through their owning financial workflows.", 400);
  }
  const codes = [...new Set(input.postings.map((posting) => posting.accountCode))];
  const accounts = await prisma.treasuryAccount.findMany({
    where: { treasuryId: treasury.id, code: { in: codes }, isActive: true },
  });
  if (accounts.length !== codes.length) throw new AppError("One or more ledger accounts are invalid or inactive.", 400);
  const accountByCode = new Map(accounts.map((account) => [account.code, account.id]));
  const assertSameRequest = (transaction: NonNullable<Awaited<ReturnType<typeof db.findJournalByIdempotency>>>) => {
    const expected = input.postings.map((p) => ({ code: p.accountCode, side: p.side, amount: p.amountMinor })).sort((a,b) => a.code.localeCompare(b.code) || a.side.localeCompare(b.side) || a.amount.localeCompare(b.amount));
    const actual = transaction.postings.map((p) => ({ code: p.account.code, side: p.side, amount: p.amountMinor.toString() })).sort((a,b) => a.code.localeCompare(b.code) || a.side.localeCompare(b.side) || a.amount.localeCompare(b.amount));
    if (transaction.type !== input.type || transaction.description !== input.description || JSON.stringify(expected) !== JSON.stringify(actual)) {
      throw new AppError("Idempotency key has already been used for a different journal transaction.", 409);
    }
    return transaction;
  };
  try {
    const result = await db.postJournal({
      treasuryId: treasury.id, actorId, type: input.type, description: input.description,
      idempotencyKey: input.idempotencyKey,
      ...(input.sourceType ? { sourceType: input.sourceType } : {}),
      ...(input.sourceId ? { sourceId: input.sourceId } : {}),
      postings: input.postings.map((posting) => ({ accountId: accountByCode.get(posting.accountCode)!, side: posting.side, amountMinor: BigInt(posting.amountMinor) })),
    });
    if (result.kind === "EXISTS") return assertSameRequest(result.transaction);
    return result.transaction;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const existing = await db.findJournalByIdempotency(treasury.id, input.idempotencyKey);
      if (existing) return assertSameRequest(existing);
    }
    throw error;
  }
};

export const reverseJournalTransaction = async (communityId: string, actorId: string, transactionId: string, input: ReverseJournalInput) => {
  await requireTreasurer(communityId, actorId);
  const treasury = await db.findTreasury(communityId);
  if (!treasury) throw new AppError("Community treasury has not been initialized.", 404);
  const original = await db.findJournal(treasury.id, transactionId);
  if (original?.sourceType === "OBLIGATION") throw new AppError("Obligation journals must be reversed through the obligation cancellation workflow.", 409);
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
