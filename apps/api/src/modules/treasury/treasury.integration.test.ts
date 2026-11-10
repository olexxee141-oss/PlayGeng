import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import { getTreasury, initializeTreasury, postJournalTransaction, reverseJournalTransaction } from "./treasury.service.js";

test("treasury journal posts balanced entries once and reverses without mutating history", async () => {
  const suffix = randomUUID();
  const userIds: string[] = [];
  let communityId: string | undefined;
  try {
    const createUser = async (label: string) => {
      const user = await prisma.user.create({
        data: { email: `treasury-${label}-${suffix}@playgeng.test`, firstName: "Treasury", lastName: label, passwordHash: "integration-test-hash" },
      });
      userIds.push(user.id);
      return user;
    };
    const creator = await createUser("creator");
    const treasurer = await createUser("treasurer");
    const admin = await createUser("admin");
    const community = await prisma.community.create({
      data: {
        name: `Treasury ${suffix.slice(0, 8)}`, slug: `treasury-${suffix.slice(0, 8)}`, ownerId: creator.id,
        members: { create: [
          { userId: creator.id, role: "CREATOR" },
          { userId: treasurer.id, role: "TREASURER" },
          { userId: admin.id, role: "ADMIN" },
        ] },
        sports: { create: { sport: "FOOTBALL", isPrimary: true } },
      },
    });
    communityId = community.id;

    await assert.rejects(initializeTreasury(community.id, creator.id, { currency: "NGN" }), (error: unknown) => error instanceof AppError && error.statusCode === 403);
    const treasury = await initializeTreasury(community.id, treasurer.id, { currency: "NGN" });
    assert.equal(treasury.accounts.length, 8);
    await assert.rejects(initializeTreasury(community.id, treasurer.id, { currency: "NGN" }), (error: unknown) => error instanceof AppError && error.statusCode === 409);

    const journalInput = {
      type: "CONTRIBUTION_RECEIVED" as const,
      description: "Verified test contribution",
      idempotencyKey: `contribution-${suffix}`,
      postings: [
        { accountCode: "CASH", side: "DEBIT" as const, amountMinor: "250000" },
        { accountCode: "CONTRIBUTION_INCOME", side: "CREDIT" as const, amountMinor: "250000" },
      ],
    };
    const posted = await postJournalTransaction(community.id, treasurer.id, journalInput);
    assert.equal(posted.status, "POSTED");
    assert.equal(posted.postings.length, 2);
    const retry = await postJournalTransaction(community.id, treasurer.id, journalInput);
    assert.equal(retry.id, posted.id);

    await assert.rejects(
      postJournalTransaction(community.id, treasurer.id, { ...journalInput, description: "Different contribution" }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
    await assert.rejects(
      postJournalTransaction(community.id, treasurer.id, { ...journalInput, idempotencyKey: `unbalanced-${suffix}`, postings: [
        { accountCode: "CASH", side: "DEBIT", amountMinor: "250000" },
        { accountCode: "CONTRIBUTION_INCOME", side: "CREDIT", amountMinor: "249999" },
      ] }),
      (error: unknown) => error instanceof AppError && error.statusCode === 400,
    );

    const summary = await getTreasury(community.id, admin.id);
    const cash = summary.balances.find((account) => account.code === "CASH");
    assert.equal(cash?.balanceMinor, "250000");

    await assert.rejects(reverseJournalTransaction(community.id, admin.id, posted.id, { idempotencyKey: `reverse-${suffix}`, reason: "Admin cannot reverse" }), (error: unknown) => error instanceof AppError && error.statusCode === 403);
    const reversal = await reverseJournalTransaction(community.id, treasurer.id, posted.id, { idempotencyKey: `reverse-${suffix}`, reason: "Duplicate contribution record" });
    assert.equal(reversal.status, "POSTED");
    assert.equal(reversal.postings.length, 2);
    await assert.rejects(
      reverseJournalTransaction(community.id, treasurer.id, posted.id, { idempotencyKey: `reverse-again-${suffix}`, reason: "Second reversal attempt" }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );

    const finalSummary = await getTreasury(community.id, admin.id);
    assert.equal(finalSummary.balances.find((account) => account.code === "CASH")?.balanceMinor, "0");
    await assert.rejects(
      prisma.journalTransaction.update({ where: { id: posted.id }, data: { description: "tampered" } }),
    );
    assert.equal((await prisma.journalTransaction.findUniqueOrThrow({ where: { id: posted.id } })).description, "Verified test contribution");
  } finally {
    if (communityId) await prisma.community.deleteMany({ where: { id: communityId } });
    for (const userId of userIds) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
