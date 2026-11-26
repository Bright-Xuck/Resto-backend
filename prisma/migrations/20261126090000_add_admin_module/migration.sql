-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "admin";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catalog";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "dispatch";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ordering";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "payments";

-- CreateEnum
CREATE TYPE "admin"."application_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "admin"."moderation_target_type" AS ENUM ('MENU_ITEM', 'RESTAURANT');

-- CreateEnum
CREATE TYPE "admin"."moderation_report_status" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "catalog"."restaurant_status" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "catalog"."item_moderation_status" AS ENUM ('VISIBLE', 'FLAGGED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ordering"."order_status" AS ENUM ('PLACED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'COMPLETED', 'DELIVERY_FAILED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ordering"."payment_method" AS ENUM ('ONLINE', 'COD');

-- CreateEnum
CREATE TYPE "payments"."payment_state" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'UNKNOWN', 'REFUNDED');

-- CreateEnum
CREATE TYPE "dispatch"."vehicle_type" AS ENUM ('MOTORCYCLE', 'BICYCLE', 'CAR');

-- CreateEnum
CREATE TYPE "dispatch"."rider_verification_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX "identity"."phone_otps_phone_created_at_idx";

-- AlterTable
ALTER TABLE "identity"."audit_logs" ADD COLUMN     "target_id" TEXT,
ADD COLUMN     "target_type" TEXT;

-- CreateTable
CREATE TABLE "admin"."merchant_applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "restaurant_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "business_permit_url" TEXT,
    "tax_id_url" TEXT,
    "status" "admin"."application_status" NOT NULL DEFAULT 'PENDING',
    "decision_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."rider_applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicleType" "dispatch"."vehicle_type" NOT NULL,
    "national_id_url" TEXT,
    "licence_url" TEXT,
    "bike_registration_url" TEXT,
    "status" "admin"."application_status" NOT NULL DEFAULT 'PENDING',
    "decision_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rider_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."moderation_reports" (
    "id" UUID NOT NULL,
    "target_type" "admin"."moderation_target_type" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "admin"."moderation_report_status" NOT NULL DEFAULT 'OPEN',
    "resolution_note" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."platform_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "admin"."admin_mfa" (
    "user_id" UUID NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "enabled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_mfa_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "admin"."admin_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" BYTEA NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."restaurants" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "catalog"."restaurant_status" NOT NULL DEFAULT 'PENDING',
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "commission_percent" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."menu_items" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_fcfa" INTEGER NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "moderation_status" "catalog"."item_moderation_status" NOT NULL DEFAULT 'VISIBLE',
    "moderation_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordering"."orders" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "rider_id" UUID,
    "status" "ordering"."order_status" NOT NULL DEFAULT 'PLACED',
    "total_fcfa" INTEGER NOT NULL,
    "payment_method" "ordering"."payment_method" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "placed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordering"."order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ordering"."order_status" NOT NULL,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "state" "payments"."payment_state" NOT NULL DEFAULT 'PENDING',
    "amount_fcfa" INTEGER NOT NULL,
    "provider" TEXT,
    "provider_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount_fcfa" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "admin_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "balance_fcfa" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."wallet_ledger_entries" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "amount_fcfa" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch"."rider_profiles" (
    "user_id" UUID NOT NULL,
    "vehicle_type" "dispatch"."vehicle_type" NOT NULL,
    "verification_status" "dispatch"."rider_verification_status" NOT NULL DEFAULT 'PENDING',
    "last_lat" DOUBLE PRECISION,
    "last_lng" DOUBLE PRECISION,
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rider_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "merchant_applications_status_idx" ON "admin"."merchant_applications"("status");

-- CreateIndex
CREATE INDEX "merchant_applications_user_id_idx" ON "admin"."merchant_applications"("user_id");

-- CreateIndex
CREATE INDEX "rider_applications_status_idx" ON "admin"."rider_applications"("status");

-- CreateIndex
CREATE INDEX "rider_applications_user_id_idx" ON "admin"."rider_applications"("user_id");

-- CreateIndex
CREATE INDEX "moderation_reports_status_idx" ON "admin"."moderation_reports"("status");

-- CreateIndex
CREATE INDEX "moderation_reports_target_type_target_id_idx" ON "admin"."moderation_reports"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_recovery_codes_code_hash_key" ON "admin"."admin_recovery_codes"("code_hash");

-- CreateIndex
CREATE INDEX "admin_recovery_codes_user_id_idx" ON "admin"."admin_recovery_codes"("user_id");

-- CreateIndex
CREATE INDEX "restaurants_status_idx" ON "catalog"."restaurants"("status");

-- CreateIndex
CREATE INDEX "restaurants_owner_id_idx" ON "catalog"."restaurants"("owner_id");

-- CreateIndex
CREATE INDEX "menu_items_restaurant_id_idx" ON "catalog"."menu_items"("restaurant_id");

-- CreateIndex
CREATE INDEX "menu_items_moderation_status_idx" ON "catalog"."menu_items"("moderation_status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "ordering"."orders"("reference");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "ordering"."orders"("status");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "ordering"."orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_restaurant_id_idx" ON "ordering"."orders"("restaurant_id");

-- CreateIndex
CREATE INDEX "orders_rider_id_idx" ON "ordering"."orders"("rider_id");

-- CreateIndex
CREATE INDEX "orders_placed_at_idx" ON "ordering"."orders"("placed_at");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "ordering"."order_events"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_events_order_id_version_key" ON "ordering"."order_events"("order_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"."payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_state_idx" ON "payments"."payments"("state");

-- CreateIndex
CREATE INDEX "refunds_order_id_idx" ON "payments"."refunds"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "payments"."wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallet_ledger_entries_wallet_id_created_at_idx" ON "payments"."wallet_ledger_entries"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "identity"."audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "admin"."merchant_applications" ADD CONSTRAINT "merchant_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."merchant_applications" ADD CONSTRAINT "merchant_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."rider_applications" ADD CONSTRAINT "rider_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."rider_applications" ADD CONSTRAINT "rider_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."moderation_reports" ADD CONSTRAINT "moderation_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."platform_settings" ADD CONSTRAINT "platform_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."admin_mfa" ADD CONSTRAINT "admin_mfa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."admin_recovery_codes" ADD CONSTRAINT "admin_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."restaurants" ADD CONSTRAINT "restaurants_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."menu_items" ADD CONSTRAINT "menu_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "catalog"."restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordering"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordering"."orders" ADD CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "catalog"."restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordering"."orders" ADD CONSTRAINT "orders_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordering"."order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ordering"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordering"."order_events" ADD CONSTRAINT "order_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ordering"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"."refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"."payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"."refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ordering"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"."refunds" ADD CONSTRAINT "refunds_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"."wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"."wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "payments"."wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"."wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch"."rider_profiles" ADD CONSTRAINT "rider_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
