import type { Request, Response } from "express";
import { recordAdminAudit } from "../services/audit.service.ts";
import {
	adjustWallet,
	getOrderTimeline,
	getWallet,
	reassignOrder,
	refundOrder,
} from "../services/adminDispute.service.ts";
import {
	idParamSchema,
	reassignSchema,
	refundSchema,
	walletAdjustSchema,
} from "../validations/admin.validation.ts";

// GET /api/admin/orders/:id/timeline - returns the order log and payment history.
export async function getOrderTimelineById(req: Request, res: Response) {
	const result = idParamSchema.safeParse(req.params);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await getOrderTimeline(result.data.id);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		res.status(200).json({ order: response.order });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load that order. Please try again." });
	}
}

// POST /api/admin/orders/:id/refund - refunds part or all of an online payment.
export async function refundOrderById(req: Request, res: Response) {
	const params = idParamSchema.safeParse(req.params);
	const body = refundSchema.safeParse(req.body);

	if (!params.success) {
		res.status(400).json({ message: params.error.issues[0]?.message });
		return;
	}

	if (!body.success) {
		res.status(400).json({ message: body.error.issues[0]?.message });
		return;
	}

	try {
		const response = await refundOrder(
			params.data.id,
			body.data.amountFcfa,
			body.data.reason,
			req.user!.sub,
		);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAdminAudit(req, {
			action: "ORDER_REFUNDED",
			actorId: req.user!.sub,
			targetType: "Order",
			targetId: params.data.id,
			details: JSON.stringify({
				amountFcfa: body.data.amountFcfa,
				reason: body.data.reason,
			}),
		});

		res.status(200).json({
			message: "The refund has been recorded.",
			refund: response.refund,
		});
	} catch (error) {
		// Two admins refunding at once can make the serializable transaction retry.
		if ((error as { code?: string }).code === "P2034") {
			res.status(409).json({
				message: "Another refund was saved at the same time. Please try again.",
			});
			return;
		}

		console.error(error);
		res.status(500).json({ message: "We could not record that refund. Please try again." });
	}
}

// POST /api/admin/orders/:id/reassign - moves the order to another verified rider.
export async function reassignOrderById(req: Request, res: Response) {
	const params = idParamSchema.safeParse(req.params);
	const body = reassignSchema.safeParse(req.body);

	if (!params.success) {
		res.status(400).json({ message: params.error.issues[0]?.message });
		return;
	}

	if (!body.success) {
		res.status(400).json({ message: body.error.issues[0]?.message });
		return;
	}

	try {
		const response = await reassignOrder(
			params.data.id,
			body.data.riderId,
			body.data.reason,
			req.user!.sub,
		);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAdminAudit(req, {
			action: "ORDER_REASSIGNED",
			actorId: req.user!.sub,
			targetType: "Order",
			targetId: params.data.id,
			details: JSON.stringify({ riderId: body.data.riderId, reason: body.data.reason }),
		});

		res.status(200).json({
			message: "The order has been reassigned.",
			order: response.order,
		});
	} catch (error) {
		// Two reassignments at once would create the same event version.
		if ((error as { code?: string }).code === "P2002") {
			res.status(409).json({
				message: "The order changed at the same time. Refresh it and try again.",
			});
			return;
		}

		console.error(error);
		res.status(500).json({ message: "We could not reassign that order. Please try again." });
	}
}

// GET /api/admin/wallets/:id - returns a wallet and its latest ledger entries.
export async function getWalletById(req: Request, res: Response) {
	const result = idParamSchema.safeParse(req.params);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await getWallet(result.data.id);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		res.status(200).json({ wallet: response.wallet });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load that wallet. Please try again." });
	}
}

// POST /api/admin/wallets/:id/adjust - adds or removes money with a ledger entry.
export async function adjustWalletById(req: Request, res: Response) {
	const params = idParamSchema.safeParse(req.params);
	const body = walletAdjustSchema.safeParse(req.body);

	if (!params.success) {
		res.status(400).json({ message: params.error.issues[0]?.message });
		return;
	}

	if (!body.success) {
		res.status(400).json({ message: body.error.issues[0]?.message });
		return;
	}

	try {
		const response = await adjustWallet(
			params.data.id,
			body.data.amountFcfa,
			body.data.reason,
			req.user!.sub,
		);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAdminAudit(req, {
			action: "WALLET_ADJUSTED",
			actorId: req.user!.sub,
			targetType: "Wallet",
			targetId: params.data.id,
			details: JSON.stringify({
				amountFcfa: body.data.amountFcfa,
				reason: body.data.reason,
			}),
		});

		res.status(200).json({
			message: "The wallet has been adjusted.",
			wallet: response.wallet,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not adjust that wallet. Please try again." });
	}
}
