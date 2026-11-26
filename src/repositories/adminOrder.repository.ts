import { randomUUID } from "node:crypto";
import type { OrderStatus } from "../generated/prisma/client.ts";
import { prisma } from "../config/prisma.ts";

// Reads order history and applies refunds and rider reassignment.
export const adminOrderRepository = {
	// Loads the full order timeline shown in the dispute console.
	findDetail(id: string) {
		return prisma.order.findUnique({
			where: { id },
			include: {
				customer: { select: { id: true, fullName: true, email: true, phone: true } },
				restaurant: { select: { id: true, name: true, phone: true, address: true } },
				rider: {
					select: {
						id: true,
						fullName: true,
						phone: true,
						riderProfile: {
							select: {
								vehicleType: true,
								verificationStatus: true,
								lastLat: true,
								lastLng: true,
								lastSeenAt: true,
							},
						},
					},
				},
				events: {
					orderBy: { version: "asc" },
					include: { createdBy: { select: { id: true, fullName: true, type: true } } },
				},
				payment: {
					include: {
						refunds: {
							orderBy: { createdAt: "desc" },
							include: { admin: { select: { id: true, fullName: true } } },
						},
					},
				},
			},
		});
	},

	// A rider may only receive an order when verified and active.
	findAssignableRider(id: string) {
		return prisma.user.findFirst({
			where: { id, type: "RIDER", status: "ACTIVE" },
			include: { riderProfile: true },
		});
	},

	// Moves the order to another rider and records the change in the timeline.
	reassign(input: {
		orderId: string;
		riderId: string;
		status: OrderStatus;
		version: number;
		note: string;
		actorId: string;
	}) {
		return prisma.$transaction(async (tx) => {
			const order = await tx.order.update({
				where: { id: input.orderId },
				data: { riderId: input.riderId, version: input.version + 1 },
			});

			await tx.orderEvent.create({
				data: {
					id: randomUUID(),
					orderId: input.orderId,
					version: input.version + 1,
					status: input.status,
					note: input.note,
					createdById: input.actorId,
				},
			});

			return order;
		});
	},

	// Creates the refund and marks the payment refunded once it is fully covered.
	// The check and the insert share one serializable transaction so two admins
	// cannot refund more than the payment together.
	createRefundChecked(input: {
		paymentId: string;
		orderId: string;
		amountFcfa: number;
		reason: string;
		adminId: string;
	}) {
		return prisma.$transaction(
			async (tx) => {
				const payment = await tx.payment.findUnique({
					where: { id: input.paymentId },
				});

				if (!payment) {
					return { ok: false as const, code: "NO_PAYMENT" as const };
				}

				const totals = await tx.refund.aggregate({
					where: { paymentId: input.paymentId },
					_sum: { amountFcfa: true },
				});

				const alreadyRefundedFcfa = totals._sum.amountFcfa ?? 0;
				const remainingFcfa = payment.amountFcfa - alreadyRefundedFcfa;

				if (remainingFcfa <= 0) {
					return { ok: false as const, code: "FULLY_REFUNDED" as const };
				}

				if (input.amountFcfa > remainingFcfa) {
					return {
						ok: false as const,
						code: "TOO_MUCH" as const,
						remainingFcfa,
					};
				}

				const refund = await tx.refund.create({
					data: {
						id: randomUUID(),
						paymentId: input.paymentId,
						orderId: input.orderId,
						amountFcfa: input.amountFcfa,
						reason: input.reason,
						adminId: input.adminId,
					},
				});

				if (alreadyRefundedFcfa + input.amountFcfa >= payment.amountFcfa) {
					await tx.payment.update({
						where: { id: input.paymentId },
						data: { state: "REFUNDED" },
					});
				}

				return { ok: true as const, refund };
			},
			{ isolationLevel: "Serializable" },
		);
	},
};
