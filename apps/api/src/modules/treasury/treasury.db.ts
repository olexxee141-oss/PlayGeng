import { prisma, type Prisma } from "@playgeng/database";

const isSerializationConflict = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2034";

export const withTreasuryTransaction = async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
  throw new Error("Treasury transaction retry limit reached.");
};

export const findCommunityAccess = (communityId: string, userId: string) =>
  prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    include: { user: { select: { status: true } }, community: { select: { status: true } } },
  });

export const initializeTreasury = (communityId: string, createdById: string, currency: string) =>
  withTreasuryTransaction(async (tx) => {
    const existing = await tx.treasury.findUnique({ where: { communityId } });
    if (existing) return { kind: "EXISTS" as const, treasury: existing };
    const treasury = await tx.treasury.create({
      data: {
        communityId,
        createdById,
        currency,
        accounts: { create: [
          { code: "CASH", name: "Cash and verified funds", type: "ASSET", isSystem: true },
          { code: "RECEIVABLES", name: "Member and registration receivables", type: "ASSET", isSystem: true },
          { code: "CONTRIBUTION_INCOME", name: "Community contribution income", type: "INCOME", isSystem: true },
          { code: "MATCH_INCOME", name: "Match fee income", type: "INCOME", isSystem: true },
          { code: "REGISTRATION_INCOME", name: "Competition registration income", type: "INCOME", isSystem: true },
          { code: "EXPENSE", name: "Community operating expenses", type: "EXPENSE", isSystem: true },
          { code: "REFUNDS", name: "Refunds and reversals", type: "EXPENSE", isSystem: true },
          { code: "OPENING_EQUITY", name: "Opening balance and adjustments", type: "EQUITY", isSystem: true },
        ] },
      },
      include: { accounts: { orderBy: { code: "asc" } } },
    });
    await tx.financialAuditEvent.create({
      data: { treasuryId: treasury.id, actorId: createdById, action: "TREASURY_INITIALIZED", entityType: "TREASURY", entityId: treasury.id, metadata: { currency } },
    });
    return { kind: "CREATED" as const, treasury };
  });

export const findTreasury = (communityId: string) =>
  prisma.treasury.findUnique({ where: { communityId }, include: { accounts: { where: { isActive: true }, orderBy: { code: "asc" } } } });

export const findJournalByIdempotency = (treasuryId: string, idempotencyKey: string) =>
  prisma.journalTransaction.findUnique({
    where: { treasuryId_idempotencyKey: { treasuryId, idempotencyKey } },
    include: { postings: { include: { account: { select: { code: true } } } } },
  });

export const postJournal = (input: {
  treasuryId: string; actorId: string; type: Prisma.JournalTransactionCreateInput["type"];
  description: string; idempotencyKey: string; sourceType?: string; sourceId?: string;
  postings: { accountId: string; side: "DEBIT" | "CREDIT"; amountMinor: bigint }[];
}) => withTreasuryTransaction(async (tx) => {
  const existing = await tx.journalTransaction.findUnique({
    where: { treasuryId_idempotencyKey: { treasuryId: input.treasuryId, idempotencyKey: input.idempotencyKey } },
    include: { postings: { include: { account: { select: { code: true } } } } },
  });
  if (existing) return { kind: "EXISTS" as const, transaction: existing };

  const transaction = await tx.journalTransaction.create({
    data: {
      treasuryId: input.treasuryId, type: input.type, description: input.description,
      idempotencyKey: input.idempotencyKey, createdById: input.actorId,
      ...(input.sourceType ? { sourceType: input.sourceType } : {}),
      ...(input.sourceId ? { sourceId: input.sourceId } : {}),
      postings: { create: input.postings.map((posting) => ({ treasuryId: input.treasuryId, accountId: posting.accountId, side: posting.side, amountMinor: posting.amountMinor })) },
    },
  });
  const posted = await tx.journalTransaction.update({
    where: { id: transaction.id },
    data: { status: "POSTED", postedAt: new Date() },
    include: { postings: { include: { account: { select: { code: true } } } } },
  });
  return { kind: "CREATED" as const, transaction: posted };
});

export const listJournal = (treasuryId: string, cursor?: string, limit = 50) =>
  prisma.journalTransaction.findMany({
    where: { treasuryId, status: "POSTED" },
    include: { postings: { include: { account: { select: { code: true, name: true, type: true } } } }, createdBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit,
  });

export const findJournal = (treasuryId: string, transactionId: string) =>
  prisma.journalTransaction.findFirst({
    where: { id: transactionId, treasuryId, status: "POSTED" },
    include: { postings: { include: { account: { select: { id: true, code: true, name: true, type: true } } } } },
  });

export const reverseJournal = (input: { treasuryId: string; transactionId: string; actorId: string; idempotencyKey: string; reason: string }) =>
  withTreasuryTransaction(async (tx) => {
    const original = await tx.journalTransaction.findFirst({
      where: { id: input.transactionId, treasuryId: input.treasuryId, status: "POSTED" },
      include: { postings: true },
    });
    if (!original) return { kind: "NOT_FOUND" as const };
    const existingReversal = await tx.journalTransaction.findFirst({ where: { reversalOfId: original.id, treasuryId: input.treasuryId } });
    if (existingReversal) return { kind: "ALREADY_REVERSED" as const, transaction: existingReversal };
    const duplicateKey = await tx.journalTransaction.findUnique({ where: { treasuryId_idempotencyKey: { treasuryId: input.treasuryId, idempotencyKey: input.idempotencyKey } } });
    if (duplicateKey) return { kind: "IDEMPOTENCY_CONFLICT" as const };
    const reversal = await tx.journalTransaction.create({
      data: {
        treasuryId: input.treasuryId, type: "REVERSAL", description: `Reversal: ${input.reason}`,
        idempotencyKey: input.idempotencyKey, createdById: input.actorId, reversalOfId: original.id,
        postings: { create: original.postings.map((posting) => ({
          treasuryId: input.treasuryId, accountId: posting.accountId,
          side: posting.side === "DEBIT" ? "CREDIT" : "DEBIT", amountMinor: posting.amountMinor,
        })) },
      },
    });
    const posted = await tx.journalTransaction.update({
      where: { id: reversal.id }, data: { status: "POSTED", postedAt: new Date() },
      include: { postings: { include: { account: { select: { code: true } } } } },
    });
    await tx.financialAuditEvent.create({
      data: { treasuryId: input.treasuryId, actorId: input.actorId, action: "JOURNAL_REVERSED", entityType: "JOURNAL_TRANSACTION", entityId: original.id, reason: input.reason, metadata: { reversalTransactionId: posted.id } },
    });
    return { kind: "CREATED" as const, transaction: posted };
  });

export const getAccountBalances = async (treasuryId: string) => {
  const accounts = await prisma.treasuryAccount.findMany({ where: { treasuryId, isActive: true }, orderBy: { code: "asc" } });
  const grouped = await prisma.ledgerPosting.groupBy({
    by: ["accountId", "side"], where: { treasuryId, journalTransaction: { status: "POSTED" } },
    _sum: { amountMinor: true },
  });
  return accounts.map((account) => {
    const debit = grouped.find((item) => item.accountId === account.id && item.side === "DEBIT")?._sum.amountMinor ?? 0n;
    const credit = grouped.find((item) => item.accountId === account.id && item.side === "CREDIT")?._sum.amountMinor ?? 0n;
    const debitNormal = account.type === "ASSET" || account.type === "EXPENSE";
    return { id: account.id, code: account.code, name: account.name, type: account.type, balanceMinor: (debitNormal ? debit - credit : credit - debit).toString() };
  });
};
