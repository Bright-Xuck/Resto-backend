import { Router } from "express";
import { getAuditLogs } from "../controllers/adminAudit.controller.ts";
import {
	decideApplicationById,
	getApplicationById,
	getApplications,
} from "../controllers/adminApplication.controller.ts";
import {
	getModerationQueue,
	getRestaurantById,
	getRestaurants,
	moderateReportById,
	updateMenuItemById,
	updateRestaurantStatus,
} from "../controllers/adminModeration.controller.ts";
import {
	adjustWalletById,
	getOrderTimelineById,
	getWalletById,
	reassignOrderById,
	refundOrderById,
} from "../controllers/adminDispute.controller.ts";
import {
	getAnalyticsReport,
	getPlatformSettings,
	getReconciliationReport,
	updatePlatformSettings,
} from "../controllers/adminAnalytics.controller.ts";
import {
	createAdminAccount,
	getAdmins,
	getUserById,
	getUsers,
	resetCredentials,
	updateAdminRole,
	updateUserStatus,
} from "../controllers/adminUser.controller.ts";
import { authenticate } from "../middlewares/authenticate.ts";
import { requireIdempotency } from "../middlewares/idempotency.ts";
import { rateLimit } from "../middlewares/rateLimit.ts";
import { requireStepUp } from "../middlewares/requireStepUp.ts";
import {
	analystOnly,
	financeOnly,
	superAdminOnly,
	supportOnly,
	supportOrFinanceOnly,
	verifierOnly,
} from "../middlewares/RBA.ts";

const router = Router();

// Every admin route needs a valid access token with an admin role.
router.use(authenticate);

// Audit log: read-only, super admins only (NFR-11).
router.get("/audit", superAdminOnly, rateLimit(120, 900, "admin-audit"), getAuditLogs);

// Merchant and rider verification queue (FR-ADM-01, FR-ADM-02).
router.get(
	"/applications",
	verifierOnly,
	rateLimit(120, 900, "admin-applications"),
	getApplications,
);
router.get(
	"/applications/:type/:id",
	verifierOnly,
	rateLimit(120, 900, "admin-application"),
	getApplicationById,
);

// Decisions change access for a real business, so the request must be idempotent.
router.post(
	"/applications/:type/:id/decision",
	verifierOnly,
	rateLimit(30, 900, "admin-application-decision"),
	requireIdempotency,
	decideApplicationById,
);

// Account search and lookup for support staff (FR-ADM-03).
router.get("/users", supportOnly, rateLimit(120, 900, "admin-users"), getUsers);
router.get("/users/:id", supportOnly, rateLimit(120, 900, "admin-user"), getUserById);

// Status changes: support may suspend; only a super admin may ban (checked in the controller).
router.patch(
	"/users/:id/status",
	supportOnly,
	rateLimit(30, 900, "admin-user-status"),
	updateUserStatus,
);

// Credential reset signs the account out everywhere (FR-ADM-03).
router.post(
	"/users/:id/credential-reset",
	supportOnly,
	rateLimit(10, 900, "admin-user-reset"),
	resetCredentials,
);

// Admin staff management is reserved for super admins.
router.get("/admins", superAdminOnly, rateLimit(60, 900, "admin-admins"), getAdmins);
router.post("/admins", superAdminOnly, rateLimit(10, 900, "admin-admin-create"), createAdminAccount);
router.patch(
	"/admins/:id/role",
	superAdminOnly,
	rateLimit(10, 900, "admin-admin-role"),
	updateAdminRole,
);

// Reported content and restaurant listings (FR-ADM-04).
router.get(
	"/moderation",
	supportOnly,
	rateLimit(120, 900, "admin-moderation"),
	getModerationQueue,
);
router.post(
	"/moderation/:id/action",
	supportOnly,
	rateLimit(30, 900, "admin-moderation-action"),
	requireIdempotency,
	moderateReportById,
);
router.get(
	"/restaurants",
	supportOnly,
	rateLimit(120, 900, "admin-restaurants"),
	getRestaurants,
);
router.get(
	"/restaurants/:id",
	supportOnly,
	rateLimit(120, 900, "admin-restaurant"),
	getRestaurantById,
);
router.patch(
	"/restaurants/:id/status",
	supportOnly,
	rateLimit(30, 900, "admin-restaurant-status"),
	updateRestaurantStatus,
);

// Admins may correct a menu item's name, price or availability (FR-ADM-04).
router.patch(
	"/menu-items/:id",
	supportOnly,
	rateLimit(30, 900, "admin-menu-item"),
	updateMenuItemById,
);

// Dispute console: support and finance can read an order's full history (FR-ADM-05).
router.get(
	"/orders/:id/timeline",
	supportOrFinanceOnly,
	rateLimit(120, 900, "admin-order-timeline"),
	getOrderTimelineById,
);

// Refunds move real money, so they need finance, a fresh code and an idempotency key.
router.post(
	"/orders/:id/refund",
	financeOnly,
	rateLimit(20, 900, "admin-order-refund"),
	requireStepUp,
	requireIdempotency,
	refundOrderById,
);

// Reassignment is idempotent because a retry must not move the order twice.
router.post(
	"/orders/:id/reassign",
	financeOnly,
	rateLimit(30, 900, "admin-order-reassign"),
	requireIdempotency,
	reassignOrderById,
);

// Wallet reads and adjustments are finance-only.
router.get("/wallets/:id", financeOnly, rateLimit(120, 900, "admin-wallet"), getWalletById);
router.post(
	"/wallets/:id/adjust",
	financeOnly,
	rateLimit(20, 900, "admin-wallet-adjust"),
	requireStepUp,
	requireIdempotency,
	adjustWalletById,
);

// KPI dashboard for analysts (FR-ADM-06).
router.get("/analytics", analystOnly, rateLimit(60, 900, "admin-analytics"), getAnalyticsReport);

// Finance reconciliation of payments, refunds and payouts.
router.get(
	"/reconciliation",
	financeOnly,
	rateLimit(60, 900, "admin-reconciliation"),
	getReconciliationReport,
);

// Global platform parameters (FR-ADM-07).
router.get("/settings", superAdminOnly, rateLimit(60, 900, "admin-settings"), getPlatformSettings);
router.put(
	"/settings",
	superAdminOnly,
	rateLimit(20, 900, "admin-settings-update"),
	updatePlatformSettings,
);

export default router;
