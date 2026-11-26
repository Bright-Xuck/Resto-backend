import { randomUUID } from "node:crypto";
import type { ApplicationStatus } from "../generated/prisma/client.ts";
import { prisma } from "../config/prisma.ts";

export type ApplicationType = "merchant" | "rider";

// Reads and decides merchant and rider applications.
export const adminApplicationRepository = {
	// Lists one page of applications of a single type.
	async list(type: ApplicationType, status: ApplicationStatus | undefined, page: number, limit: number) {
		const where = status ? { status } : {};

		if (type === "merchant") {
			const [applications, total] = await prisma.$transaction([
				prisma.merchantApplication.findMany({
					where,
					orderBy: { createdAt: "asc" },
					skip: (page - 1) * limit,
					take: limit,
					include: {
						user: { select: { id: true, fullName: true, email: true, phone: true } },
					},
				}),
				prisma.merchantApplication.count({ where }),
			]);

			return { applications, total };
		}

		const [applications, total] = await prisma.$transaction([
			prisma.riderApplication.findMany({
				where,
				orderBy: { createdAt: "asc" },
				skip: (page - 1) * limit,
				take: limit,
				include: {
					user: { select: { id: true, fullName: true, email: true, phone: true } },
				},
			}),
			prisma.riderApplication.count({ where }),
		]);

		return { applications, total };
	},

	// Loads one merchant application with the applicant.
	findMerchant(id: string) {
		return prisma.merchantApplication.findUnique({
			where: { id },
			include: {
				user: {
					select: { id: true, fullName: true, email: true, phone: true, status: true },
				},
			},
		});
	},

	// Loads one rider application with the applicant.
	findRider(id: string) {
		return prisma.riderApplication.findUnique({
			where: { id },
			include: {
				user: {
					select: { id: true, fullName: true, email: true, phone: true, status: true },
				},
			},
		});
	},

	// Reads the platform's default commission, falling back to 10 percent.
	async defaultCommissionPercent() {
		const setting = await prisma.platformSetting.findUnique({
			where: { key: "default_commission_percent" },
		});

		const value = Number(setting?.value);

		return Number.isInteger(value) && value >= 0 && value <= 100 ? value : 10;
	},

	// Approves or rejects a merchant application and opens the restaurant on approval.
	decideMerchant(input: {
		id: string;
		status: ApplicationStatus;
		note: string;
		reviewerId: string;
		commissionPercent: number;
	}) {
		return prisma.$transaction(async (tx) => {
			// Only a still-pending application can be decided, which blocks double clicks.
			const changed = await tx.merchantApplication.updateMany({
				where: { id: input.id, status: "PENDING" },
				data: {
					status: input.status,
					decisionNote: input.note,
					reviewedById: input.reviewerId,
					reviewedAt: new Date(),
				},
			});

			if (changed.count === 0) {
				return null;
			}

			const application = await tx.merchantApplication.findUniqueOrThrow({
				where: { id: input.id },
			});

			// Approval creates the restaurant listing so the merchant can start trading.
			if (input.status === "APPROVED") {
				const existing = await tx.restaurant.findFirst({
					where: { ownerId: application.userId, name: application.restaurantName },
				});

				if (!existing) {
					await tx.restaurant.create({
						data: {
							id: randomUUID(),
							ownerId: application.userId,
							name: application.restaurantName,
							category: application.category,
							phone: application.phone,
							address: application.address,
							status: "APPROVED",
							isOpen: false,
							commissionPercent: input.commissionPercent,
						},
					});
				}
			}

			return application;
		});
	},

	// Approves or rejects a rider application and marks the rider profile verified.
	decideRider(input: {
		id: string;
		status: ApplicationStatus;
		note: string;
		reviewerId: string;
	}) {
		return prisma.$transaction(async (tx) => {
			const changed = await tx.riderApplication.updateMany({
				where: { id: input.id, status: "PENDING" },
				data: {
					status: input.status,
					decisionNote: input.note,
					reviewedById: input.reviewerId,
					reviewedAt: new Date(),
				},
			});

			if (changed.count === 0) {
				return null;
			}

			const application = await tx.riderApplication.findUniqueOrThrow({
				where: { id: input.id },
			});

			// Approval unlocks the rider profile used by dispatch.
			if (input.status === "APPROVED") {
				await tx.riderProfile.upsert({
					where: { userId: application.userId },
					create: {
						userId: application.userId,
						vehicleType: application.vehicleType,
						verificationStatus: "APPROVED",
					},
					update: {
						vehicleType: application.vehicleType,
						verificationStatus: "APPROVED",
					},
				});
			}

			return application;
		});
	},

	// Counts pending applications so the dashboard can show a queue badge.
	async pendingCounts() {
		const [merchant, rider] = await prisma.$transaction([
			prisma.merchantApplication.count({ where: { status: "PENDING" } }),
			prisma.riderApplication.count({ where: { status: "PENDING" } }),
		]);

		return { merchant, rider };
	},
};
