import {
	adminAnalyticsRepository,
	analyticsStatuses,
} from "../repositories/adminAnalytics.repository.ts";

// Formats a date as YYYY-MM-DD so daily rows group by calendar day.
function dayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

// Builds every KPI the admin dashboard shows for the selected range (FR-ADM-06).
export async function getAnalytics(from: Date, to: Date) {
	const [orders, activeOrders, logins, statusCounts] = await Promise.all([
		adminAnalyticsRepository.ordersInRange(from, to),
		adminAnalyticsRepository.countActiveOrders(),
		adminAnalyticsRepository.loginsInRange(from, to),
		adminAnalyticsRepository.countOrdersByStatus(from, to),
	]);

	const voidStatuses = new Set<string>(analyticsStatuses.VOID_STATUSES);

	// GMV excludes cancelled, rejected and failed orders.
	const countedOrders = orders.filter((order) => !voidStatuses.has(order.status));
	const gmvFcfa = countedOrders.reduce((sum, order) => sum + order.totalFcfa, 0);

	// Commission is only earned on completed orders.
	const completedOrders = orders.filter((order) => order.status === "COMPLETED");
	const commissionEarnedFcfa = completedOrders.reduce(
		(sum, order) =>
			sum + Math.round((order.totalFcfa * order.restaurant.commissionPercent) / 100),
		0,
	);

	// Average delivery time in minutes over orders that have both timestamps.
	const deliveryMinutes = completedOrders
		.filter((order) => order.completedAt !== null)
		.map((order) => (order.completedAt!.getTime() - order.placedAt.getTime()) / 60_000);

	const averageDeliveryMinutes =
		deliveryMinutes.length === 0
			? 0
			: Math.round(
					(deliveryMinutes.reduce((sum, value) => sum + value, 0) /
						deliveryMinutes.length) *
						10,
				) / 10;

	// Daily active users: distinct accounts that logged in each day.
	const activeUsersByDay = new Map<string, Set<string>>();

	for (const login of logins) {
		if (!login.userId) {
			continue;
		}

		const key = dayKey(login.createdAt);
		const set = activeUsersByDay.get(key) ?? new Set<string>();
		set.add(login.userId);
		activeUsersByDay.set(key, set);
	}

	// Daily order and GMV series for the chart.
	const dailyMap = new Map<string, { orders: number; gmvFcfa: number }>();

	for (const order of countedOrders) {
		const key = dayKey(order.placedAt);
		const row = dailyMap.get(key) ?? { orders: 0, gmvFcfa: 0 };
		row.orders += 1;
		row.gmvFcfa += order.totalFcfa;
		dailyMap.set(key, row);
	}

	const daily = [...dailyMap.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, row]) => ({
			date,
			orders: row.orders,
			gmvFcfa: row.gmvFcfa,
			activeUsers: activeUsersByDay.get(date)?.size ?? 0,
		}));

	const ordersByStatus = Object.fromEntries(
		statusCounts.map((row) => [row.status, row._count._all]),
	);

	return {
		range: { from, to },
		activeOrders,
		dailyActiveUsers: activeUsersByDay.size === 0
			? 0
			: Math.round(
					[...activeUsersByDay.values()].reduce((sum, set) => sum + set.size, 0) /
						activeUsersByDay.size,
				),
		gmvFcfa,
		commissionEarnedFcfa,
		averageDeliveryMinutes,
		ordersByStatus,
		daily,
	};
}

// Summarises payments and refunds for the finance reconciliation screen.
export async function getReconciliation() {
	const [unknownPayments, totals] = await Promise.all([
		adminAnalyticsRepository.unknownPayments(),
		adminAnalyticsRepository.reconciliationTotals(),
	]);

	const byState = Object.fromEntries(
		totals.payments.map((row) => [
			row.state,
			{ count: row._count._all, amountFcfa: row._sum.amountFcfa ?? 0 },
		]),
	);

	const completedFcfa = totals.completedOrders.reduce(
		(sum, order) => sum + order.totalFcfa,
		0,
	);

	const commissionFcfa = totals.completedOrders.reduce(
		(sum, order) =>
			sum + Math.round((order.totalFcfa * order.restaurant.commissionPercent) / 100),
		0,
	);

	return {
		paymentsByState: byState,
		refunds: {
			count: totals.refunds._count._all,
			amountFcfa: totals.refunds._sum.amountFcfa ?? 0,
		},
		completedOrdersFcfa: completedFcfa,
		platformCommissionFcfa: commissionFcfa,
		merchantPayableFcfa: completedFcfa - commissionFcfa,
		deliveryPayoutsFcfa: totals.deliveryPayouts._sum.amountFcfa ?? 0,
		unknownPayments,
	};
}
