-- The initial migration inverted this rule: it required riders to have an email.
-- Riders are phone-first; non-riders require an email.
ALTER TABLE "identity"."users" DROP CONSTRAINT "users_email_required_check";

ALTER TABLE "identity"."users"
    ADD CONSTRAINT "users_email_required_check" CHECK ("type" = 'RIDER' OR "email" IS NOT NULL);
