import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prisma } from "@playgeng/database";
import { initializeTreasury } from "../treasury/treasury.service.js";
import { settleVerifiedProviderEvent } from "./financial-service.service.js";

test("provider settlement requires validated evidence and posts Treasury effects atomically once", async () => {
  const suffix = randomUUID();
  try {
    const user = await prisma.user.create({
      data: { email: `financial-${suffix}@playgeng.test`, firstName: "Financial", lastName: "Test", passwordHash: "integration-test-hash" },
    });
    const community = await prisma.community.create({
      data: {
        name: `Financial ${suffix.slice(0, 8)}`, slug: `financial-${suffix.slice(0, 8)}`, ownerId: user.id,
        members: { create: { userId: user.id, role: "CREATOR" } },
        sports: { create: { sport: "FOOTBALL", isPrimary: true } },
      },
    });
    const treasury = await initializeTreasury(community.id, user.id, { currency: "NGN" });
    const provider = await prisma.financialProvider.create({ data: { code: `TEST_${suffix.slice(0, 8)}`, displayName: "Integration Test Provider" } });
    const collection = await prisma.financialCollection.create({
      data: {
        providerId: provider.id, treasuryId: treasury.id, memberId: user.id, createdById: user.id,
        amountMinor: 250000n, currency: "NGN", idempotencyKey: `collection-${suffix}`, status: "PENDING",
      },
    });
    const unvalidatedId = `unvalidated-${suffix}`;
    await prisma.providerEvent.create({
      data: {
        providerId: provider.id, collectionId: collection.id, externalEventId: unvalidatedId,
        eventType: "collection.success", status: "RECEIVED",
        payload: { success: true, amountMinor: "250000", currency: "NGN" },
      },
    });
    const unvalidated = await settleVerifiedProviderEvent({ providerCode: provider.code, externalEventId: unvalidatedId, systemActorId: user.id });
    assert.equal(unvalidated.kind, "EVENT_NOT_VALIDATED");
    assert.equal(await prisma.paymentReceipt.count({ where: { treasuryId: treasury.id } }), 0);

    const eventId = `validated-${suffix}`;
    await prisma.providerEvent.create({
      data: {
        providerId: provider.id, collectionId: collection.id, externalEventId: eventId,
        eventType: "collection.success", status: "VALIDATED",
        payload: { success: true, amountMinor: "250000", currency: "NGN", receivedAt: new Date().toISOString() },
      },
    });
    const settled = await settleVerifiedProviderEvent({ providerCode: provider.code, externalEventId: eventId, systemActorId: user.id });
    assert.equal(settled.kind, "SETTLED");
    assert.equal(await prisma.paymentReceipt.count({ where: { treasuryId: treasury.id } }), 1);
    assert.equal(await prisma.journalTransaction.count({ where: { treasuryId: treasury.id, status: "POSTED" } }), 1);
    assert.equal(await prisma.ledgerPosting.count({ where: { treasuryId: treasury.id } }), 2);
    assert.equal(await prisma.financialSettlement.count({ where: { collectionId: collection.id, status: "SETTLED" } }), 1);
    assert.equal((await prisma.financialCollection.findUniqueOrThrow({ where: { id: collection.id } })).status, "SUCCEEDED");

    const retry = await settleVerifiedProviderEvent({ providerCode: provider.code, externalEventId: eventId, systemActorId: user.id });
    assert.equal(retry.kind, "EXISTS");
    assert.equal(await prisma.paymentReceipt.count({ where: { treasuryId: treasury.id } }), 1);

    const mismatchCollection = await prisma.financialCollection.create({
      data: {
        providerId: provider.id, treasuryId: treasury.id, memberId: user.id, createdById: user.id,
        amountMinor: 100000n, currency: "NGN", idempotencyKey: `mismatch-${suffix}`, status: "PENDING",
      },
    });
    const mismatchId = `mismatch-event-${suffix}`;
    await prisma.providerEvent.create({
      data: {
        providerId: provider.id, collectionId: mismatchCollection.id, externalEventId: mismatchId,
        eventType: "collection.success", status: "VALIDATED",
        payload: { success: true, amountMinor: "99000", currency: "NGN" },
      },
    });
    const mismatch = await settleVerifiedProviderEvent({ providerCode: provider.code, externalEventId: mismatchId, systemActorId: user.id });
    assert.equal(mismatch.kind, "RECONCILIATION_REQUIRED");
    assert.equal(await prisma.financialReconciliationRecord.count({ where: { collectionId: mismatchCollection.id, status: "DISCREPANCY" } }), 1);
    assert.equal(await prisma.paymentReceipt.count({ where: { treasuryId: treasury.id } }), 1);
    assert.equal(await prisma.financialSettlement.count({ where: { collectionId: mismatchCollection.id, status: "RECONCILIATION_REQUIRED" } }), 1);
  } finally {
    await prisma.$disconnect();
  }
});
