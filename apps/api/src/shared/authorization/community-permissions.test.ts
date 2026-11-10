import assert from "node:assert/strict";
import test from "node:test";
import { roleHasCommunityPermission } from "./community-role-policy.js";

test("admin can manage community operations but cannot archive the community", () => {
  assert.equal(roleHasCommunityPermission("ADMIN", "MANAGE_COMMUNITY"), true);
  assert.equal(roleHasCommunityPermission("ADMIN", "MANAGE_MEMBERS"), true);
  assert.equal(roleHasCommunityPermission("ADMIN", "MANAGE_MATCHES"), true);
  assert.equal(roleHasCommunityPermission("ADMIN", "MANAGE_TEAMS"), true);
  assert.equal(roleHasCommunityPermission("ADMIN", "MANAGE_COMPETITIONS"), true);
  assert.equal(roleHasCommunityPermission("ADMIN", "ARCHIVE_COMMUNITY"), false);
});

test("organizer can manage sporting activity but not community membership or settings", () => {
  assert.equal(roleHasCommunityPermission("ORGANIZER", "MANAGE_MATCHES"), true);
  assert.equal(roleHasCommunityPermission("ORGANIZER", "MANAGE_TEAMS"), true);
  assert.equal(roleHasCommunityPermission("ORGANIZER", "MANAGE_COMPETITIONS"), true);
  assert.equal(roleHasCommunityPermission("ORGANIZER", "MANAGE_COMMUNITY"), false);
  assert.equal(roleHasCommunityPermission("ORGANIZER", "MANAGE_MEMBERS"), false);
});

test("treasurer, member and creator membership labels do not grant operational permissions by themselves", () => {
  for (const role of ["TREASURER", "MEMBER", "CREATOR"]) {
    for (const permission of ["MANAGE_COMMUNITY", "MANAGE_MEMBERS", "ARCHIVE_COMMUNITY", "MANAGE_MATCHES", "MANAGE_TEAMS", "MANAGE_COMPETITIONS"] as const) {
      assert.equal(roleHasCommunityPermission(role, permission), false);
    }
  }
});
