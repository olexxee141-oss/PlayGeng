import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import { getTreasury, initializeTreasury } from "./treasury.service.js";
import { cancel, create, getOne, listForFinance, listForMember } from "./obligations.service.js";

test("obligations issue receivables, are idempotent, member-scoped and cancel through reversal", async () => {
  const suffix = randomUUID();
  try {
    const createUser = async (label: string) => prisma.user.create({
      data: { email: `obligation-${label}-${suffix}@playgeng.test`, firstName: "Obligation", lastName: label, passwordHash: "integration-test-hash" },
    });
    const creator = await createUser("creator");
    const treasurer = await createUser("treasurer");
    const member = await createUser("member");
    const admin = await createUser("admin");
    const community = await prisma.community.create({
      data: {
        name: `Obligation ${suffix.slice(0, 8)}`, slug: `obligation-${suffix.slice(0, 8)}`, ownerId: creator.id,
        members: { create: [
          { userId: creator.id, role: "CREATOR" },
          { userId: treasurer.id, role: "TREASURER" },
          { userId: member.id, role: "MEMBER" },
          { userId: admin.id, role: "ADMIN" },
        ] },
        sports: { create: { sport: "FOOTBALL", isPrimary: true } },
      },
    });
    await initializeTreasury(community.id, treasurer.id, { currency: "NGN" });

    const input = {
      memberId: member.id,
      sourceType: "CONTRIBUTION" as const,
      sourceId: `campaign-member-${suffix}`,
      idempotencyKey: `obligation-${suffix}`,
      description: "November community contribution",
      amountMinor: "150000",
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    await assert.rejects(create(community.id, admin.id, input), (error: unknown) => error instanceof AppError && error.statusCode === 403);

    const obligation = await create(community.id, treasurer.id, input);
    assert.equal(obligation.amountMinor, "150000");
    assert.equal(obligation.allocatedMinor, "0");
    assert.equal(obligation.outstandingMinor, "150000");
    assert.equal(obligation.status, "OPEN");

    const retry = await create(community.id, treasurer.id, input);
    assert.equal(retry.id, obligation.id);
    await assert.rejects(create(community.id, treasurer.id, { ...input, amountMinor: "160000" }), (error: unknown) => error instanceof AppError && error.statusCode === 409);

    const mine = await listForMember(community.id, member.id);
    assert.equal(mine.length, 1);
    assert.equal(mine[0]?.id, obligation.id);
    assert.equal((await listForFinance(community.id, admin.id)).length, 1);
    await assert.rejects(getOne(community.id, admin.id, obligation.id), (error: unknown) => error instanceof AppError && error.statusCode === 403);
    assert.equal((await getOne(community.id, member.id, obligation.id)).id, obligation.id);

    const summary = await getTreasury(community.id, admin.id);
    assert.equal(summary.balances.find((account) => account.code === "CASH")?.balanceMinor, "0");
    assert.equal(summary.balances.find((account) => account.code === "RECEIVABLES")?.balanceMinor, "150000");
    assert.equal(summary.balances.find((account) => account.code === "CONTRIBUTION_INCOME")?.balanceMinor, "150000");

    const cancelled = await cancel(community.id, treasurer.id, obligation.id, {
      reason: "Contribution assessment was entered in error",
      idempotencyKey: `cancel-${suffix}`,
    });
    assert.equal(cancelled.status, "CANCELLED");
    const cancellationRetry = await cancel(community.id, treasurer.id, obligation.id, {
      reason: "Contribution assessment was entered in error",
      idempotencyKey: "cancel-" + suffix,
    });
    assert.equal(cancellationRetry.status, "CANCELLED");
    await assert.rejects(
      cancel(community.id, treasurer.id, obligation.id, {
        reason: "Different cancellation reason",
        idempotencyKey: "cancel-" + suffix,
      }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
    const afterCancellation = await getTreasury(community.id, admin.id);
    assert.equal(afterCancellation.balances.find((account) => account.code === "CASH")?.balanceMinor, "0");
    assert.equal(afterCancellation.balances.find((account) => account.code === "RECEIVABLES")?.balanceMinor, "0");
    assert.equal(afterCancellation.balances.find((account) => account.code === "CONTRIBUTION_INCOME")?.balanceMinor, "0");
    assert.equal((await getOne(community.id, member.id, obligation.id)).status, "CANCELLED");
  } finally {
    // This test uses a disposable CI database. Treasury and audit history are intentionally non-deletable.
    await prisma.$disconnect();
  }
});
