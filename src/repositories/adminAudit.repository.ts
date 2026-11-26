import type { Prisma } from "../generated/prisma/client.ts";
import { prisma } from "../config/prisma.ts";

// Filters the admin can use when reading the audit log.
export type AuditLogFilters = {
	action?: string;
	targetType?: string;
	targetId?: string;
	actorId?: string;
	from?: Date;
	to?: Date;
};

// Lists audit rows newest first with the actor attached.
export const adminAuditRepository = {
	async list(filters: AuditLogFilters, page: number, limit: number) {
		const where: Prisma.AuditLogWhereInput = {};

		if (filters.action) {
			where.action = { contains: filters.action, mode: "insensitive" };
		}

		if (filters.targetType) {
			where.targetType = filters.targetType;
		}

		if (filters.targetId) {
			where.targetId = filters.targetId;
		}

		if (filters.actorId) {
			where.userId = filters.actorId;
		}

		if (filters.from || filters.to) {
			where.createdAt = {
				...(filters.from ? { gte: filters.from } : {}),
				...(filters.to ? { lte: filters.to } : {}),
			};
		}

		const [logs, total] = await prisma.$transaction([
			prisma.auditLog.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * limit,
				take: limit,
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							type: true,
							adminRole: true,
						},
					},
				},
			}),
			prisma.auditLog.count({ where }),
		]);

		return { logs, total };
	},
};
