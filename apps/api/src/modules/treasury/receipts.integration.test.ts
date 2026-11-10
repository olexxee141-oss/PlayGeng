import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import { AppError } from "../../shared/errors/app-error.js";
import { getTreasury, initializeTreasury } from "./treasury.service.js";
import { create as createObligation, cancel as cancelObligation } from "./obligations.service.js";
import { getOne, listForFinance, listMine, verifyManualReceipt } from "./receipts.service.js";

test("manual receipts verify once, allocate atomically, protect balances and serialize concurrent settlement", async () => {
  const suffix = randomUUID();
  try {
    const createUser = async (label: string) => prisma.user.create({
      data: { email: `receipt-${label}-${suffix}@playgeng.test`, firstName: "Receipt", lastName: label, passwordHash: "integration-test-hash" },
    });
    const creator = await createUser("creator");
    const treasurer = await createUser("treasurer");
    const member = await createUser("member");
    const otherMember = await createUser("other");
    const admin = await createUser("admin");
    const community = await prisma.community.create({
      data: {
        name: `Receipt ${suffix.slice(0, 8)}`, slug: `receipt-${suffix.slice(0, 8)}`, ownerId: creator.id,
        members: { create: [
          { userId: creator.id, role: "CREATOR" },
          { userId: treasurer.id, role: "TREASURER" },
          { userId: member.id, role: "MEMBER" },
          { userId: otherMember.id, role: "MEMBER" },
          { userId: admin.id, role: "ADMIN" },
        ] },
        sports: { create: { sport: "FOOTBALL", isPrimary: true } },
      },
    });
    await initializeTreasury(community.id, treasurer.id, { currency: "NGN" });

    const createDue = (sourceId: string, amountMinor: string) => createObligation(community.id, treasurer.id, {
      memberId: member.id,
      sourceType: "CONTRIBUTION",
      sourceId,
      idempotencyKey: `obl-${sourceId}`,
      description: "Community contribution",
      amountMinor,
    });
    const first = await createDue(`first-${suffix}`, "1000000");
    const second = await createDue(`second-${suffix}`, "500000");
    const receiptInput = {
      memberId: member.id,
      externalReference: `bank-transfer-${suffix}`,
      evidenceReference: `bank-statement-entry-${suffix}`,
      idempotencyKey: `receipt-${suffix}`,
      amountMinor: "1200000",
      receivedAt: new Date(Date.now() - 60_000).toISOString(),
      allocations: [
        { obligationId: first.id, amountMinor: "900000" },
        { obligationId: second.id, amountMinor: "300000" },
      ],
    };

    await assert.rejects(
      verifyManualReceipt(community.id, admin.id, receiptInput),
      (error: unknown) => error instanceof AppError && error.statusCode === 403,
    );
    await assert.rejects(
      verifyManualReceipt(community.id, treasurer.id, { ...receiptInput, amountMinor: "1300000" }),
      (error: unknown) => error instanceof AppError && error.statusCode === 400,
    );
    await assert.rejects(
      verifyManualReceipt(community.id, treasurer.id, { ...receiptInput, allocations: [{ obligationId: first.id, amountMinor: "1200000" }], amountMinor: "1200000" }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
    const otherMemberDue = await createObligation(community.id, treasurer.id, {
      memberId: otherMember.id,
      sourceType: "CONTRIBUTION",
      sourceId: `other-member-${suffix}`,
      idempotencyKey: `other-member-${suffix}`,
      description: "Other member contribution",
      amountMinor: "100000",
    });
    await assert.rejects(
      verifyManualReceipt(community.id, treasurer.id, {
        ...receiptInput,
        allocations: [{ obligationId: otherMemberDue.id, amountMinor: "100000" }],
        amountMinor: "100000",
      }),
      (error: unknown) => error instanceof AppError && error.statusCode === 400,
    );

    const receipt = await verifyManualReceipt(community.id, treasurer.id, receiptInput);
    assert.equal(receipt.amountMinor, "1200000");
    assert.equal(receipt.allocations.length, 2);
    assert.equal(receipt.currency, "NGN");
    assert.equal(receipt.source, "MANUAL_RECONCILIATION");

    const retry = await verifyManualReceipt(community.id, treasurer.id, receiptInput);
    assert.equal(retry.id, receipt.id);
    await assert.rejects(
      verifyManualReceipt(community.id, treasurer.id, { ...receiptInput, amountMinor: "1100000" }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
    await assert.rejects(
      verifyManualReceipt(community.id, treasurer.id, { ...receiptInput, idempotencyKey: `different-${suffix}` }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );

    const mine = await listMine(community.id, member.id);
    assert.equal(mine.length, 1);
    assert.equal(mine[0]?.id, receipt.id);
    assert.equal((await listForFinance(community.id, admin.id)).length, 1);
    await assert.rejects(getOne(community.id, otherMember.id, receipt.id), (error: unknown) => error instanceof AppError && error.statusCode === 403);
    assert.equal((await getOne(community.id, member.id, receipt.id)).id, receipt.id);

    const firstAfter = await prisma.obligation.findUniqueOrThrow({ where: { id: first.id }, include: { allocations: true } });
    const secondAfter = await prisma.obligation.findUniqueOrThrow({ where: { id: second.id }, include: { allocations: true } });
    assert.equal(firstAfter.allocations.reduce((sum, item) => sum + item.amountMinor, 0n), 900000n);
    assert.equal(secondAfter.allocations.reduce((sum, item) => sum + item.amountMinor, 0n), 300000n);
    await assert.rejects(
      cancelObligation(community.id, treasurer.id, first.id, { reason: "Cannot cancel settled obligation", idempotencyKey: `cancel-${suffix}` }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );

    const summary = await getTreasury(community.id, admin.id);
    assert.equal(summary.balances.find((account) => account.code === "CASH")?.balanceMinor, "1200000");
    assert.equal(summary.balances.find((account) => account.code === "RECEIVABLES")?.balanceMinor, "300000");
    assert.equal(summary.balances.find((account) => account.code === "CONTRIBUTION_INCOME")?.balanceMinor, "1500000");

    const duplicateReferenceDue = await createDue(`duplicate-reference-${suffix}`, "1000000");
    await assert.rejects(
      verifyManualReceipt(community.id, treasurer.id, {
        ...receiptInput,
        idempotencyKey: `duplicate-reference-${suffix}`,
        evidenceReference: `second-evidence-${suffix}`,
        amountMinor: "100000",
        allocations: [{ obligationId: duplicateReferenceDue.id, amountMinor: "100000" }],
      }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );

    const concurrentDue = await createDue(`concurrent-${suffix}`, "1000000");
    const makeConcurrentReceipt = (label: string) => verifyManualReceipt(community.id, treasurer.id, {
      memberId: member.id,
      externalReference: `concurrent-bank-${label}-${suffix}`,
      evidenceReference: `concurrent-evidence-${label}-${suffix}`,
      idempotencyKey: `concurrent-receipt-${label}-${suffix}`,
      amountMinor: "800000",
      receivedAt: new Date(Date.now() - 30_000).toISOString(),
      allocations: [{ obligationId: concurrentDue.id, amountMinor: "800000" }],
    });
    const concurrent = await Promise.allSettled([makeConcurrentReceipt("a"), makeConcurrentReceipt("b")]);
    assert.equal(concurrent.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(concurrent.filter((item) => item.status === "rejected").length, 1);
    const finalObligation = await prisma.obligation.findUniqueOrThrow({ where: { id: concurrentDue.id }, include: { allocations: true } });
    assert.equal(finalObligation.allocations.reduce((sum, item) => sum + item.amountMinor, 0n), 800000n);
  } finally {
    // This test uses a disposable CI database. Financial receipts, ledger postings and audit history are append-only.
    await prisma.$disconnect();
  }
});
