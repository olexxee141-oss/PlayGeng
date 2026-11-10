import assert from "node:assert/strict";
import test from "node:test";
import { contributionReportQuerySchema, createAssessmentSchema, createCampaignSchema, transitionSchema, updateAssessmentSchema } from "./contributions.validator.js";

test("monthly campaign generation mode is optional and accepts both explicit modes", () => {
  const base = { name: "Monthly dues", amountMinor: "250000", frequency: "MONTHLY" };
  assert.equal(createCampaignSchema.parse(base).assessmentGenerationMode, undefined);
  assert.equal(createCampaignSchema.parse({ ...base, assessmentGenerationMode: "AUTOMATIC" }).assessmentGenerationMode, "AUTOMATIC");
  assert.equal(createCampaignSchema.parse({ ...base, assessmentGenerationMode: "MANUAL" }).assessmentGenerationMode, "MANUAL");
});

test("campaign creation rejects non-positive or non-integer minor-unit amounts and unknown fields", () => {
  const base = { name: "Monthly dues", amountMinor: "250000", frequency: "MONTHLY" };
  assert.equal(createCampaignSchema.safeParse({ ...base, amountMinor: "0" }).success, false);
  assert.equal(createCampaignSchema.safeParse({ ...base, amountMinor: "25.50" }).success, false);
  assert.equal(createCampaignSchema.safeParse({ ...base, unexpected: true }).success, false);
});

test("assessment periods and due dates are validated", () => {
  assert.equal(createAssessmentSchema.safeParse({ periodKey: "2026-11" }).success, true);
  assert.equal(createAssessmentSchema.safeParse({ periodKey: "ONE_OFF" }).success, true);
  assert.equal(createAssessmentSchema.safeParse({ periodKey: "2026-13" }).success, false);
  assert.equal(updateAssessmentSchema.safeParse({ dueAt: "2026-11-30T23:59:59.000Z" }).success, true);
  assert.equal(updateAssessmentSchema.safeParse({ dueAt: "not-a-date" }).success, false);
});

test("lifecycle transitions require an auditable reason", () => {
  assert.equal(transitionSchema.safeParse({ reason: "Pause pending member review" }).success, true);
  assert.equal(transitionSchema.safeParse({ reason: "no" }).success, false);
  assert.equal(transitionSchema.safeParse({ reason: "Valid reason", extra: true }).success, false);
});


test("contribution reporting pagination is bounded and rejects unknown query fields", () => {
  assert.deepEqual(contributionReportQuerySchema.parse({}), { limit: 25 });
  assert.deepEqual(contributionReportQuerySchema.parse({ cursor: "snapshot_123", limit: "50" }), { cursor: "snapshot_123", limit: 50 });
  assert.equal(contributionReportQuerySchema.safeParse({ limit: "0" }).success, false);
  assert.equal(contributionReportQuerySchema.safeParse({ limit: "101" }).success, false);
  assert.equal(contributionReportQuerySchema.safeParse({ includeEvidence: "true" }).success, false);
});
