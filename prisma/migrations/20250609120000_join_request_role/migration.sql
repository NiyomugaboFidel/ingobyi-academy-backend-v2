-- Join requests: requested role + user relation

ALTER TABLE "OrgJoinRequest" ADD COLUMN "requestedRole" "UserRole" NOT NULL DEFAULT 'STUDENT';

ALTER TABLE "OrgJoinRequest" ADD CONSTRAINT "OrgJoinRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "OrgJoinRequest_status_idx" ON "OrgJoinRequest"("status");
