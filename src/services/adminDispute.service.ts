import { adminOrderRepository } from "../repositories/adminOrder.repository.ts";
import { adminWalletRepository } from "../repositories/adminWallet.repository.ts";

// A failed admin call with the HTTP status and a client-friendly message.
export type DisputeFailure = { ok: false; status: number; message: string };

// Statuses where the rider can still be swapped.
const REASSIGNABLE_STATUSES = new Set([
	"PLACED",
	"ACCEPTED",
	"PREPARING",
	"READY_FOR_PICKUP",
	"OUT_FOR_DELIVERY",
]);

// Loads one order with events, payment, refunds and the rider's last location.
export async function getOrderTimeline(orderId: string) {
	const order = await adminOrderRepository.findDetail(orderId);

	if (!order) {
		return {
			ok: false as const,
			status: 404,
			message: "That order does not exist.",
		};
	}

	return { ok: true as const, order };
}

// Refunds part or all of an online payment.
export async function refundOrder(
	orderId: string,
	amountFcfa: number,
	reason: string,
	adminId: string,
): Promise<{ ok: true; refund: unknown } | DisputeFailure> {
	const order = await adminOrderRepository.findDetail(orderId);

	if (!order) {
		return { ok: false, status: 404, message: "That order does not exist." };
	}

	if (!order.payment) {
		return {
			ok: false,
			status: 400,
			message: "This order has no online payment to refund.",
		};
	}

	const result = await adminOrderRepository.createRefundChecked({
		paymentId: order.payment.id,
		orderId,
		amountFcfa,
		reason,
		adminId,
	});

	if (!result.ok) {
		if (result.code === "FULLY_REFUNDED") {
			return {
				ok: false,
				status: 400,
				message: "This payment has already been fully refunded.",
			};
		}

		if (result.code === "TOO_MUCH") {
			return {
				ok: false,
				status: 400,
				message: `You can refund at most ${result.remainingFcfa} FCFA on this payment.`,
			};
		}

		return {
			ok: false,
			status: 400,
			message: "This order has no online payment to refund.",
		};
	}

	return { ok: true, refund: result.refund };
}

// Moves an active order to another verified rider.
export async function reassignOrder(
	orderId: string,
	riderId: string,
	reason: string,
	actorId: string,
): Promise<{ ok: true; order: unknown } | DisputeFailure> {
	const order = await adminOrderRepository.findDetail(orderId);

	if (!order) {
		return { ok: false, status: 404, message: "That order does not exist." };
	}

	if (!REASSIGNABLE_STATUSES.has(order.status)) {
		return {
			ok: false,
			status: 400,
			message: "This order can no longer be reassigned.",
		};
	}

	if (order.riderId === riderId) {
		return {
			ok: false,
			status: 400,
			message: "That rider is already assigned to this order.",
		};
	}

	const rider = await adminOrderRepository.findAssignableRider(riderId);

	if (!rider) {
		return {
			ok: false,
			status: 400,
			message: "That rider account is not active.",
		};
	}

	if (rider.riderProfile?.verificationStatus !== "APPROVED") {
		return {
			ok: false,
			status: 400,
			message: "That rider has not been verified yet.",
		};
	}

	const updated = await adminOrderRepository.reassign({
		orderId,
		riderId,
		status: order.status,
		version: order.version,
		note: `Reassigned by an admin: ${reason}`,
		actorId,
	});

	return { ok: true, order: updated };
}

// Loads one wallet with its ledger.
export async function getWallet(walletId: string) {
	const wallet = await adminWalletRepository.findDetail(walletId);

	if (!wallet) {
		return { ok: false as const, status: 404, message: "That wallet does not exist." };
	}

	return { ok: true as const, wallet };
}

// Adds or removes money from a wallet, never letting it go below zero.
export async function adjustWallet(
	walletId: string,
	amountFcfa: number,
	reason: string,
	actorId: string,
): Promise<{ ok: true; wallet: unknown } | DisputeFailure> {
	const wallet = await adminWalletRepository.findDetail(walletId);

	if (!wallet) {
		return { ok: false, status: 404, message: "That wallet does not exist." };
	}

	if (wallet.balanceFcfa + amountFcfa < 0) {
		return {
			ok: false,
			status: 400,
			message: `That adjustment would make the wallet negative. The balance is ${wallet.balanceFcfa} FCFA.`,
		};
	}

	const updated = await adminWalletRepository.adjust({
		walletId,
		amountFcfa,
		reason,
		actorId,
	});

	// A null result means another request used the money first.
	if (!updated) {
		return {
			ok: false,
			status: 400,
			message: "That adjustment would make the wallet negative.",
		};
	}

	return { ok: true, wallet: updated };
}
