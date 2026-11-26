import { prisma } from "../config/prisma.ts";

// Statuses that count as an order still being worked on.
const ACTIVE_STATUSES = [
	"PLACED",
	"ACCEPTED",
	"PREPARING",
	"READY_FOR_PICKUP",
	"OUT_FOR_DELIVERY",
] as const;

// Statuses that never count toward GMV.
const VOID_STATUSES = ["CANCELLED", "REJECTED", "DELIVERY_FAILED"] as const;

// Reads the numbers behind the analytics dashboard.
export const adminAnalyticsRepository = {
	// Loads the orders placed in the range with the fields the KPIs need.
	ordersInRange(from: Date, to: Date) {
		return prisma.order.findMany({
			where: { placedAt: { gte: from, lte: to } },
			select: {
				id: true,
				status: true,
				totalFcfa: true,
				placedAt: true,
				completedAt: true,
				restaurant: { select: { commissionPercent: true } },
			},
		});
	},

	countActiveOrders() {
		return prisma.order.count({ where: { status: { in: [...ACTIVE_STATUSES] } } });
	},

	// Users who logged in during the range, used for the daily active user KPI.
	loginsInRange(from: Date, to: Date) {
		return prisma.auditLog.findMany({
			where: {
				action: { in: ["LOGIN", "ADMIN_LOGIN"] },
				userId: { not: null },
				createdAt: { gte: from, lte: to },
			},
			select: { userId: true, createdAt: true },
		});
	},

	countOrdersByStatus(from: Date, to: Date) {
		return prisma.order.groupBy({
			by: ["status"],
			where: { placedAt: { gte: from, lte: to } },
			_count: { _all: true },
		});
	},

	// Payments that need a human to check them.
	unknownPayments() {
		return prisma.payment.findMany({
			where: { state: "UNKNOWN" },
			orderBy: { createdAt: "asc" },
			include: { order: { select: { reference: true, totalFcfa: true, status: true } } },
		});
	},

	// Totals used by the finance reconciliation screen.
	async reconciliationTotals() {
		const [payments, refunds, completedOrders, deliveryPayouts] = await prisma.$transaction([
			prisma.payment.groupBy({
				by: ["state"],
				_count: { _all: true },
				_sum: { amountFcfa: true },
			}),
			prisma.refund.aggregate({ _count: { _all: true }, _sum: { amountFcfa: true } }),
			prisma.order.findMany({
				where: { status: "COMPLETED" },
				select: { totalFcfa: true, restaurant: { select: { commissionPercent: true } } },
			}),
			prisma.walletLedgerEntry.aggregate({
				where: { reason: "Delivery payout" },
				_sum: { amountFcfa: true },
			}),
		]);

		return { payments, refunds, completedOrders, deliveryPayouts };
	},
};

// Exported so the service can use the same status lists.
export const analyticsStatuses = { ACTIVE_STATUSES, VOID_STATUSES };
