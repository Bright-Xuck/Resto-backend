import { z } from "zod";

// Shared page and limit fields for admin list endpoints.
export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Query options for the audit log list.
export const auditQuerySchema = paginationSchema.extend({
	action: z.string().trim().min(1).max(100).optional(),
	targetType: z.string().trim().min(1).max(50).optional(),
	targetId: z.string().trim().min(1).max(100).optional(),
	actorId: z.string().uuid("actorId must be a UUID").optional(),
	from: z.coerce.date().optional(),
	to: z.coerce.date().optional(),
});

// Search and filter options for the account list.
export const userListQuerySchema = paginationSchema.extend({
	q: z.string().trim().min(1).max(100).optional(),
	type: z.enum(["CUSTOMER", "MERCHANT", "RIDER", "ADMIN"]).optional(),
	status: z.enum(["ACTIVE", "SUSPENDED", "BANNED", "DELETED"]).optional(),
});

// Body for suspending, banning or reactivating an account.
export const userStatusSchema = z.object({
	status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
	reason: z.string().trim().min(3, "Give a short reason for this change").max(500),
});

// Route parameter shared by admin user endpoints.
export const idParamSchema = z.object({
	id: z.string().uuid("That account id is not valid"),
});

const adminRole = z.enum(["SUPER_ADMIN", "VERIFIER", "SUPPORT", "FINANCE", "ANALYST"]);

// Body for creating another admin account.
export const createAdminSchema = z.object({
	email: z.string().trim().toLowerCase().email("Enter a valid email address"),
	fullName: z
		.string()
		.trim()
		.min(2, "Full name is required")
		.max(80, "Full name is too long")
		.regex(/^[A-Za-zÀ-ÿ' -]+$/, "Full name contains invalid characters"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	adminRole,
});

// Body for changing an admin's sub-role.
export const adminRoleSchema = z.object({ adminRole });

// Merchant or rider application type in the route.
export const applicationTypeSchema = z.enum(["merchant", "rider"]);

// Route parameters for application endpoints.
export const applicationParamsSchema = z.object({
	type: applicationTypeSchema,
	id: z.string().uuid("That application id is not valid"),
});

// Query options for the application queue.
export const applicationQuerySchema = paginationSchema.extend({
	type: applicationTypeSchema.default("merchant"),
	status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

// Body for approving or rejecting an application. A note is always required.
export const applicationDecisionSchema = z.object({
	decision: z.enum(["APPROVE", "REJECT"]),
	note: z
		.string()
		.trim()
		.min(3, "Explain the decision in a short note")
		.max(1000, "The note is too long"),
});

// Query options for the moderation queue.
export const moderationQuerySchema = paginationSchema.extend({
	status: z.enum(["OPEN", "RESOLVED"]).optional(),
});

// Body for acting on a reported item.
export const moderationActionSchema = z.object({
	action: z.enum(["FLAG", "HIDE", "RESTORE", "REMOVE"]),
	note: z
		.string()
		.trim()
		.min(3, "Explain the moderation action in a short note")
		.max(500, "The note is too long"),
});

// Query options for the restaurant list.
export const restaurantQuerySchema = paginationSchema.extend({
	q: z.string().trim().min(1).max(100).optional(),
	status: z.enum(["PENDING", "APPROVED", "SUSPENDED"]).optional(),
});

// Body for suspending or restoring a restaurant listing.
export const restaurantStatusSchema = z.object({
	status: z.enum(["APPROVED", "SUSPENDED"]),
	note: z.string().trim().min(3, "Give a short reason for this change").max(500),
});

// Body for editing a menu item. At least one field must be sent.
export const menuItemUpdateSchema = z
	.object({
		name: z.string().trim().min(2, "Item name is too short").max(120, "Item name is too long").optional(),
		priceFcfa: z
			.number()
			.int("Price must be a whole number of FCFA")
			.min(0, "Price cannot be negative")
			.max(100_000_000, "That price is too large")
			.optional(),
		isAvailable: z.boolean().optional(),
	})
	.refine((data) => Object.values(data).some((value) => value !== undefined), {
		message: "Send at least one field to change",
	});

// Money amounts are whole FCFA values.
const fcfaAmount = z
	.number()
	.int("Amount must be a whole number of FCFA")
	.max(100_000_000, "That amount is too large");

// Body for refunding an online payment.
export const refundSchema = z.object({
	amountFcfa: fcfaAmount.positive("The refund amount must be greater than zero"),
	reason: z.string().trim().min(3, "Give a short reason for the refund").max(500),
});

// Body for moving an order to another rider.
export const reassignSchema = z.object({
	riderId: z.string().uuid("That rider id is not valid"),
	reason: z.string().trim().min(3, "Give a short reason for the reassignment").max(500),
});

// Body for adjusting a wallet balance. Negative amounts take money out.
export const walletAdjustSchema = z.object({
	amountFcfa: fcfaAmount.refine((value) => value !== 0, {
		message: "The adjustment cannot be zero",
	}),
	reason: z.string().trim().min(3, "Give a short reason for the adjustment").max(500),
});

// Date range for analytics. Defaults are applied in the controller.
export const analyticsQuerySchema = z.object({
	from: z.coerce.date().optional(),
	to: z.coerce.date().optional(),
});

// Keys the settings screen is allowed to change.
export const settingKeys = [
	"platform_name",
	"support_phone",
	"categories",
	"delivery_fee_fcfa",
	"min_order_fcfa",
	"default_commission_percent",
	"delivery_radius_km",
] as const;

const numericSettingKeys = new Set([
	"delivery_fee_fcfa",
	"min_order_fcfa",
	"default_commission_percent",
	"delivery_radius_km",
]);

// One setting entry: numbers must be whole and non-negative.
const settingEntrySchema = z
	.object({
		key: z.enum(settingKeys),
		value: z.string().trim().min(1, "A setting value is required").max(500),
	})
	.superRefine((entry, ctx) => {
		if (!numericSettingKeys.has(entry.key)) {
			return;
		}

		const number = Number(entry.value);

		if (!Number.isInteger(number) || number < 0) {
			ctx.addIssue({
				code: "custom",
				message: `${entry.key} must be a whole number of zero or more`,
			});
			return;
		}

		if (entry.key === "default_commission_percent" && number > 100) {
			ctx.addIssue({
				code: "custom",
				message: "The commission percentage cannot be more than 100",
			});
		}
	});

// Body for updating platform settings.
export const settingsUpdateSchema = z.object({
	settings: z
		.array(settingEntrySchema)
		.min(1, "Send at least one setting")
		.max(30)
		.refine((items) => new Set(items.map((item) => item.key)).size === items.length, {
			message: "Each setting key can only appear once",
		}),
});
