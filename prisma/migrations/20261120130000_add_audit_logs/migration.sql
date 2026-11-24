-- Stores security-relevant actions such as registrations, logins and password resets.
CREATE TABLE "identity"."audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_user_id_idx" ON "identity"."audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx" ON "identity"."audit_logs"("action");
CREATE INDEX "audit_logs_created_at_idx" ON "identity"."audit_logs"("created_at");

ALTER TABLE "identity"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
