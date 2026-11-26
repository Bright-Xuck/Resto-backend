import { prisma } from "../config/prisma.ts";

// Stores and replays responses for admin requests that carry an Idempotency-Key.
export const adminIdempotencyRepository = {
	find(userId: string, route: string, key: string) {
		return prisma.idempotencyKey.findUnique({
			where: { userId_route_key: { userId, route, key } },
		});
	},

	create(data: {
		id: string;
		userId: string;
		route: string;
		key: string;
		requestHash: string;
		expiresAt: Date;
	}) {
		return prisma.idempotencyKey.create({ data });
	},

	saveResponse(id: string, status: number, body: string) {
		return prisma.idempotencyKey.update({
			where: { id },
			data: { responseStatus: status, responseBody: body },
		});
	},

	remove(id: string) {
		return prisma.idempotencyKey.delete({ where: { id } });
	},

	// Expired keys are only removed when the same key is used again.
	removeExpired(userId: string, route: string, key: string) {
		return prisma.idempotencyKey.deleteMany({
			where: { userId, route, key, expiresAt: { lte: new Date() } },
		});
	},
};
