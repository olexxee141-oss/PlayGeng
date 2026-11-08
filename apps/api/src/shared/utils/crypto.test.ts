import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "./crypto.js";

test("password hashes are salted and verify only the matching password", async () => {
  const password = "correct-horse-battery-staple";
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.notEqual(firstHash, password);
  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword("incorrect-password", firstHash), false);
});

test("opaque tokens are random and their hashes are deterministic", () => {
  const firstToken = createOpaqueToken();
  const secondToken = createOpaqueToken();

  assert.notEqual(firstToken, secondToken);
  assert.equal(hashToken(firstToken), hashToken(firstToken));
  assert.notEqual(hashToken(firstToken), firstToken);
});
