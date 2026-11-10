export type CommunityPermission =
  | "MANAGE_COMMUNITY"
  | "MANAGE_MEMBERS"
  | "ARCHIVE_COMMUNITY"
  | "MANAGE_MATCHES"
  | "MANAGE_TEAMS"
  | "MANAGE_COMPETITIONS";

const rolePermissions: Record<CommunityPermission, readonly string[]> = {
  MANAGE_COMMUNITY: ["ADMIN"],
  MANAGE_MEMBERS: ["ADMIN"],
  ARCHIVE_COMMUNITY: [],
  MANAGE_MATCHES: ["ADMIN", "ORGANIZER"],
  MANAGE_TEAMS: ["ADMIN", "ORGANIZER"],
  MANAGE_COMPETITIONS: ["ADMIN", "ORGANIZER"],
};

export const roleHasCommunityPermission = (role: string, permission: CommunityPermission): boolean =>
  rolePermissions[permission].includes(role);
