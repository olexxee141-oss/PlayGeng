-- Rename the legacy OWNER membership label to CREATOR.
-- Community.ownerId remains the authoritative creator identity.
ALTER TYPE "CommunityMemberRole" RENAME VALUE 'OWNER' TO 'CREATOR';
