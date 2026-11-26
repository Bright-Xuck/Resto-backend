import type {
	ItemModerationStatus,
	ModerationReportStatus,
	RestaurantStatus,
} from "../generated/prisma/client.ts";
import { prisma } from "../config/prisma.ts";

export type ModerationAction = "FLAG" | "HIDE" | "RESTORE" | "REMOVE";

// Reads moderation reports and applies the support team's decision.
export const adminModerationRepository = {
	// Lists reports newest first and attaches the reported menu item or restaurant.
	async list(status: ModerationReportStatus | undefined, page: number, limit: number) {
		const where = status ? { status } : {};

		const [reports, total] = await prisma.$transaction([
			prisma.moderationReport.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * limit,
				take: limit,
			}),
			prisma.moderationReport.count({ where }),
		]);

		const itemIds = reports
			.filter((report) => report.targetType === "MENU_ITEM")
			.map((report) => report.targetId);

		const restaurantIds = reports
			.filter((report) => report.targetType === "RESTAURANT")
			.map((report) => report.targetId);

		const [items, restaurants] = await prisma.$transaction([
			prisma.menuItem.findMany({
				where: { id: { in: itemIds } },
				select: {
					id: true,
					name: true,
					priceFcfa: true,
					isAvailable: true,
					moderationStatus: true,
					moderationNote: true,
					restaurant: { select: { id: true, name: true } },
				},
			}),
			prisma.restaurant.findMany({
				where: { id: { in: restaurantIds } },
				select: { id: true, name: true, status: true, isOpen: true },
			}),
		]);

		const itemMap = new Map(items.map((item) => [item.id, item]));
		const restaurantMap = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));

		// The target may have been deleted, so it can be missing here.
		const withTargets = reports.map((report) => ({
			...report,
			target:
				report.targetType === "MENU_ITEM"
					? (itemMap.get(report.targetId) ?? null)
					: (restaurantMap.get(report.targetId) ?? null),
		}));

		return { reports: withTargets, total };
	},

	findReport(id: string) {
		return prisma.moderationReport.findUnique({ where: { id } });
	},

	findMenuItem(id: string) {
		return prisma.menuItem.findUnique({ where: { id } });
	},

	// Resolves the report and updates the reported content in one transaction.
	applyAction(input: {
		reportId: string;
		targetType: "MENU_ITEM" | "RESTAURANT";
		targetId: string;
		action: ModerationAction;
		note: string;
		actorId: string;
	}) {
		return prisma.$transaction(async (tx) => {
			// Only an open report can be acted on.
			const changed = await tx.moderationReport.updateMany({
				where: { id: input.reportId, status: "OPEN" },
				data: {
					status: "RESOLVED",
					resolutionNote: input.note,
					resolvedById: input.actorId,
					resolvedAt: new Date(),
				},
			});

			if (changed.count === 0) {
				return null;
			}

			if (input.targetType === "MENU_ITEM") {
				let moderationStatus: ItemModerationStatus = "HIDDEN";

				if (input.action === "FLAG") {
					moderationStatus = "FLAGGED";
				} else if (input.action === "RESTORE") {
					moderationStatus = "VISIBLE";
				}

				await tx.menuItem.update({
					where: { id: input.targetId },
					data: {
						moderationStatus,
						moderationNote: input.action === "RESTORE" ? null : input.note,
						// A removed item must also disappear from the live menu.
						...(input.action === "REMOVE" ? { isAvailable: false } : {}),
					},
				});
			} else {
				await tx.restaurant.update({
					where: { id: input.targetId },
					data: {
						status: input.action === "RESTORE" ? "APPROVED" : "SUSPENDED",
						// Suspension closes the restaurant immediately.
						...(input.action === "RESTORE" ? {} : { isOpen: false }),
					},
				});
			}

			return tx.moderationReport.findUnique({ where: { id: input.reportId } });
		});
	},

	// Lists restaurants for the moderation screen.
	async listRestaurants(
		filters: { q?: string; status?: RestaurantStatus },
		page: number,
		limit: number,
	) {
		const where = {
			...(filters.status ? { status: filters.status } : {}),
			...(filters.q ? { name: { contains: filters.q, mode: "insensitive" as const } } : {}),
		};

		const [restaurants, total] = await prisma.$transaction([
			prisma.restaurant.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * limit,
				take: limit,
				include: {
					owner: { select: { id: true, fullName: true, email: true, phone: true } },
					_count: { select: { menuItems: true, orders: true } },
				},
			}),
			prisma.restaurant.count({ where }),
		]);

		return { restaurants, total };
	},

	findRestaurant(id: string) {
		return prisma.restaurant.findUnique({ where: { id } });
	},

	// Loads one restaurant with its owner and full menu for the edit screen.
	findRestaurantDetail(id: string) {
		return prisma.restaurant.findUnique({
			where: { id },
			include: {
				owner: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
				menuItems: { orderBy: { name: "asc" } },
			},
		});
	},

	// Updates only the fields an admin may edit on a menu item.
	updateMenuItem(
		id: string,
		data: { name?: string; priceFcfa?: number; isAvailable?: boolean },
	) {
		return prisma.menuItem.update({
			where: { id },
			data,
			include: { restaurant: { select: { id: true, name: true } } },
		});
	},

	updateRestaurantStatus(id: string, status: RestaurantStatus) {
		return prisma.restaurant.update({
			where: { id },
			data: { status, ...(status === "SUSPENDED" ? { isOpen: false } : {}) },
		});
	},
};
