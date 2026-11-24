-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "identity";

-- CreateEnum
CREATE TYPE "identity"."user_type" AS ENUM ('CUSTOMER', 'MERCHANT', 'RIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "identity"."user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "identity"."admin_role" AS ENUM ('SUPER_ADMIN', 'VERIFIER', 'SUPPORT', 'FINANCE', 'ANALYST');

-- CreateEnum
CREATE TYPE "identity"."email_token_purpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "identity"."phone_otp_purpose" AS ENUM ('RIDER_SIGNUP', 'PHONE_CHANGE');

-- CreateTable
CREATE TABLE "identity"."users" (
    "id" UUID NOT NULL,
    "type" "identity"."user_type" NOT NULL,
    "status" "identity"."user_status" NOT NULL DEFAULT 'ACTIVE',
    "admin_role" "identity"."admin_role",
    "email" TEXT,
    "email_verified_at" TIMESTAMPTZ(6),
    "phone" TEXT,
    "phone_verified_at" TIMESTAMPTZ(6),
    "password_hash" TEXT NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "full_name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "device_id" TEXT,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."email_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "identity"."email_token_purpose" NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),

    CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."user_consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."phone_otps" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "identity"."phone_otp_purpose" NOT NULL DEFAULT 'RIDER_SIGNUP',
    -- Store HMAC-SHA256(code, server pepper); a plain hash of 6 digits is brute-forceable.
    "code_hash" BYTEA NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "identity"."refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "identity"."refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_tokens_token_hash_key" ON "identity"."email_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "identity"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."email_tokens" ADD CONSTRAINT "email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints that Prisma cannot express in schema.prisma
ALTER TABLE "identity"."users"
    ADD CONSTRAINT "users_email_or_phone_check" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL),
    ADD CONSTRAINT "users_email_required_check" CHECK ("type" <> 'RIDER' OR "email" IS NOT NULL),
    ADD CONSTRAINT "users_phone_required_for_rider_check" CHECK ("type" <> 'RIDER' OR "phone" IS NOT NULL),
    ADD CONSTRAINT "users_admin_role_matches_type_check" CHECK (("type" = 'ADMIN') = ("admin_role" IS NOT NULL)),
    ADD CONSTRAINT "users_phone_e164_check" CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{7,14}$'),
    ADD CONSTRAINT "users_rider_phone_verified_check" CHECK ("type" <> 'RIDER' OR "phone_verified_at" IS NOT NULL);

ALTER TABLE "identity"."phone_otps"
    ADD CONSTRAINT "phone_otps_phone_e164_check" CHECK ("phone" ~ '^\+[1-9][0-9]{7,14}$'),
    ADD CONSTRAINT "phone_otps_attempts_check" CHECK ("attempts" >= 0);

-- Partial and expression indexes that Prisma cannot express in schema.prisma
CREATE UNIQUE INDEX "users_email_uq" ON "identity"."users" (LOWER("email")) WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "users_phone_uq" ON "identity"."users" ("phone") WHERE "deleted_at" IS NULL;

CREATE INDEX "refresh_tokens_active_user_idx" ON "identity"."refresh_tokens" ("user_id") WHERE "revoked_at" IS NULL;

-- Only one OTP may be active per phone and purpose; issuing a new code closes the old one.
CREATE UNIQUE INDEX "phone_otps_active_uq" ON "identity"."phone_otps" ("phone", "purpose") WHERE "used_at" IS NULL;

CREATE INDEX "phone_otps_phone_created_at_idx" ON "identity"."phone_otps" ("phone", "created_at" DESC);
