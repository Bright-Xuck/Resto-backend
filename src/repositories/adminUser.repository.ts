import type { AdminRole, Prisma, UserStatus, UserType } from "../generated/prisma/client.ts";
import { prisma } from "../config/prisma.ts";

export type UserFilters = {
	q?: string;
	type?: UserType;
	status?: UserStatus;
};

// Fields that are safe to return to the admin dashboard.
const publicUserSelect = {
	id: true,
	type: true,
	status: true,
	adminRole: true,
	email: true,
	phone: true,
	fullName: true,
	locale: true,
	emailVerifiedAt: true,
	phoneVerifiedAt: true,
	lockedUntil: true,
	createdAt: true,
	updatedAt: true,
} satisfies Prisma.UserSelect;

export type AdminPublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

// Split admin account changes into their own repository because they need extra checks.
export const adminUserRepository = {
	// Searches users by name, email or phone.
	async list(filters: UserFilters, page: number, limit: number) {
		const where: Prisma.UserWhereInput = {};

		if (filters.type) {
			where.type = filters.type;
		}

		if (filters.status) {
			where.status = filters.status;
		}

		if (filters.q) {
			where.OR = [
				{ fullName: { contains: filters.q, mode: "insensitive" } },
				{ email: { contains: filters.q, mode: "insensitive" } },
				{ phone: { contains: filters.q } },
			];
		}

		const [users, total] = await prisma.$transaction([
			prisma.user.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * limit,
				take: limit,
				select: publicUserSelect,
			}),
			prisma.user.count({ where }),
		]);

		return { users, total };
	},

	// Loads one account with the extra data the account screen shows.
	findDetail(id: string) {
		return prisma.user.findUnique({
			where: { id },
			select: {
				...publicUserSelect,
				failedAttempts: true,
				wallet: { select: { id: true, balanceFcfa: true } },
				_count: { select: { customerOrders: true, riderOrders: true, restaurants: true } },
			},
		});
	},

	updateStatus(id: string, status: UserStatus): Promise<AdminPublicUser> {
		return prisma.user.update({
			where: { id },
			data: { status },
			select: publicUserSelect,
		});
	},

	// Resets the password, clears lockouts and revokes every device session.
	resetCredentials(id: string, passwordHash: string) {
		return prisma.$transaction([
			prisma.user.update({
				where: { id },
				data: { passwordHash, failedAttempts: 0, lockedUntil: null },
			}),
			prisma.refreshToken.updateMany({
				where: { userId: id, revokedAt: null },
				data: { revokedAt: new Date(), revokedReason: "CREDENTIAL_RESET" },
			}),
		]);
	},

	countActiveSuperAdmins() {
		return prisma.user.count({
			where: { type: "ADMIN", adminRole: "SUPER_ADMIN", status: "ACTIVE" },
		});
	},

	// Lists admin accounts only, for the super admin staff screen.
	listAdmins(page: number, limit: number) {
		const where: Prisma.UserWhereInput = { type: "ADMIN" };

		return prisma.$transaction([
			prisma.user.findMany({
				where,
				orderBy: { createdAt: "asc" },
				skip: (page - 1) * limit,
				take: limit,
				select: {
					id: true,
					email: true,
					fullName: true,
					adminRole: true,
					status: true,
					createdAt: true,
					adminMfa: { select: { enabledAt: true } },
				},
			}),
			prisma.user.count({ where }),
		]);
	},

	createAdmin(data: {
		id: string;
		email: string;
		passwordHash: string;
		fullName: string;
		adminRole: AdminRole;
	}): Promise<AdminPublicUser> {
		return prisma.user.create({
			data: {
				...data,
				type: "ADMIN",
				locale: "en",
			},
			select: publicUserSelect,
		});
	},

	updateAdminRole(id: string, adminRole: AdminRole): Promise<AdminPublicUser> {
		return prisma.user.update({
			where: { id },
			data: { adminRole },
			select: publicUserSelect,
		});
	},

	findById(id: string) {
		return prisma.user.findUnique({ where: { id } });
	},

	findByEmail(email: string) {
		return prisma.user.findFirst({
			where: { email: { equals: email, mode: "insensitive" } },
		});
	},
};
